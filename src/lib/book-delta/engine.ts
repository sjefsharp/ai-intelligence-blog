/**
 * Book Delta — Engine
 *
 * Generates candidate Book Delta proposals from verified research findings.
 * Implements the evidence-based proposal discovery sequence:
 * 1. Consume the validated canonical fact dossier
 * 2. Identify findings with potential enduring educational value
 * 3. Distinguish novel knowledge from temporary release information
 * 4. Compare findings with existing educational knowledge when accessible
 * 5. Consult the canonical thesaurus
 * 6. Consult the architecture-principles register
 * 7. Inspect available historical Book Delta proposals
 * 8. Identify actual gaps, contradictions or opportunities for improvement
 * 9. Examine counterevidence and applicability boundaries
 * 10. Formulate a specific proposed change
 * 11. Attach supporting evidence
 * 12. Validate uniqueness and completeness
 * 13. Persist the proposal in the established knowledge workflow
 * 14. Report its status in the research audit
 */

import {
	type BookDeltaProposal,
	type BookDeltaArtifact,
	type BookDeltaEvaluationResult,
	type BookDeltaKnowledgeContinuityResult,
	type BookDeltaCategory,
	type BookDeltaLifecycle,
	type EvidenceClassification,
	type VerificationStatus,
	type VerificationLevel,
	type TargetAudience,
	type KnowledgeDomain,
	type EducationalValue,
	type MaterialUncertainty,
	type TargetDocumentAccess,
	type UniquenessStatus,
	type BilingualString,
	type AuthoritativeSourceReference,
	type CanonicalClaimReference,
	type ResearchDateRange,
	type AcceptanceCriterion,
	type TargetDocumentReference,
	type TerminologyReference,
	type PrincipleReference,
	type Counterevidence,
	type AccessibilityConsiderations,
	type DurabilityAssessment,
	type MethodologicalCaveats,
	type HistoricalProposalReference,
	BOOK_DELTA_ID_PATTERNS,
	BOOK_DELTA_SCHEMA_VERSION,
	BookDeltaCategorySchema,
	BookDeltaLifecycleSchema,
	EvidenceClassificationSchema,
	VerificationStatusSchema,
	VerificationLevelSchema,
	TargetAudienceSchema,
	KnowledgeDomainSchema,
	EducationalValueSchema,
	MaterialUncertaintySchema,
	TargetDocumentAccessSchema,
	UniquenessStatusSchema,
	BilingualStringSchema,
	AuthoritativeSourceReferenceSchema,
	CanonicalClaimReferenceSchema,
	ResearchDateRangeSchema,
	AcceptanceCriterionSchema,
	TargetDocumentReferenceSchema,
	TerminologyReferenceSchema,
	PrincipleReferenceSchema,
	CounterevidenceSchema,
	AccessibilityConsiderationsSchema,
	DurabilityAssessmentSchema,
	MethodologicalCaveatsSchema,
} from "./schema.js";
import {
	validateBookDeltaProposal,
	computeObjectHash,
	canonicalStringify,
} from "./validate.js";

import {
	generateProposalId,
	generateDeterministicProposalId,
	generateDeterministicArtifactId,
	normalizeConcept,
	persistBookDeltaProposal,
	persistBookDeltaArtifact,
	persistBookDeltaEvaluationResult,
	persistBookDeltaKnowledgeContinuityResult,
	readAllBookDeltaProposals,
	readAllProposalsAcrossEditions,
	loadExistingArtifact,
	getProposalPath,
	checkBookDeltaArtifactsExist,
	listBookDeltaEditions,
	updateHistoricalProposalsIndex,
	checkProposalUniqueness,
	findHistoricalProposals,
} from "./store.js";

import type {
	CanonicalFactDossier,
	CanonicalCandidate,
	ConsolidatedClaim,
	CanonicalSourceReference,
	CandidateTimestamps,
} from "../fact-dossier/schema.js";
import type { TerminologyEntry } from "../thesaurus/schema.js";
import type { ArchitecturePrinciple } from "../architecture-principles/schema.js";
import type { HistoricalRegressionReport } from "../historical-regression/schema.js";
import type { EditorialSelectionManifest } from "../editorial-selection/schema.js";
import { createFreeLLMClient, type FreeLLMClient } from "../free-llm-client.js";
import { promises as fs } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ENGINE_ROOT = join(
	dirname(fileURLToPath(import.meta.url)),
	"..",
	"..",
	"..",
);

/** Recursively list project-local Markdown/MDX files under a root. */
async function listMarkdownFiles(root: string): Promise<string[]> {
	const files: string[] = [];

	async function walk(dir: string): Promise<void> {
		let entries;
		try {
			entries = await fs.readdir(dir, { withFileTypes: true });
		} catch {
			return;
		}
		for (const entry of entries) {
			if (entry.name === "node_modules" || entry.name.startsWith("."))
				continue;
			const fullPath = join(dir, entry.name);
			if (entry.isDirectory()) {
				await walk(fullPath);
			} else if (entry.isFile() && /\.mdx?$/.test(entry.name)) {
				files.push(fullPath);
			}
		}
	}

	await walk(root);
	return files.sort();
}

/** Merge proposal groups by stable ID; the latest update wins. */
function mergeProposalsById(
	...groups: BookDeltaProposal[][]
): BookDeltaProposal[] {
	const merged = new Map<string, BookDeltaProposal>();
	for (const group of groups) {
		for (const proposal of group) {
			const existing = merged.get(proposal.proposalId);
			if (!existing || proposal.updatedAt >= existing.updatedAt) {
				merged.set(proposal.proposalId, proposal);
			}
		}
	}
	return [...merged.values()].sort((a, b) =>
		a.proposalId.localeCompare(b.proposalId),
	);
}

// ============================================================================
// Configuration
// ============================================================================

export interface BookDeltaEngineConfig {
	editionDate: string;
	factDossier: CanonicalFactDossier;
	thesaurusEntries: TerminologyEntry[];
	architecturePrinciples: ArchitecturePrinciple[];
	historicalRegression?: HistoricalRegressionReport;
	editorialManifest?: EditorialSelectionManifest;
	llmClient?: FreeLLMClient;
	enableModelAssistedDiscovery: boolean;
	enableTargetDocumentInspection: boolean;
	minConfidenceForProposal: number;
	maxProposalsPerEdition: number;
}

export const DEFAULT_BOOK_DELTA_CONFIG: Partial<BookDeltaEngineConfig> = {
	enableModelAssistedDiscovery: true,
	enableTargetDocumentInspection: true,
	minConfidenceForProposal: 0.65,
	maxProposalsPerEdition: 10,
};

// ============================================================================
// Internal Types
// ============================================================================

interface CandidateFinding {
	candidateId: string;
	claimId: string;
	claimStatement: string;
	claimType: string;
	evidenceClassification: EvidenceClassification;
	verificationStatus: VerificationStatus;
	verificationLevel: VerificationLevel;
	confidence: number;
	sourceIds: string[];
	sourceUrls: string[];
	/** Full authoritative source references from the canonical fact dossier. */
	sources: CanonicalSourceReference[];
	researchDomains: string[];
	organizations: string[];
	technologies: string[];
	factualHeadline: string;
	exactStatement: string;
	/** Limiting evidence recorded on the canonical claim; preserved verbatim. */
	limitingEvidence: string[];
	/** Traceable timestamps from the candidate; used for research date ranges. */
	timestamps: CandidateTimestamps;
	/** First discovery ring of the candidate, used only as an explicit tier fallback. */
	discoveryRingFallback?: 1 | 2 | 3;
}

interface ProposalCandidate {
	category: BookDeltaCategory;
	targetConcept: string;
	title: BilingualString;
	currentGap: BilingualString;
	proposedChange: BilingualString;
	rationale: BilingualString;
	supportingClaimIds: string[];
	originalSources: AuthoritativeSourceReference[];
	researchDates: ResearchDateRange;
	evidenceClassification: EvidenceClassification;
	confidence: number;
	materialUncertainty: MaterialUncertainty;
	educationalValue: EducationalValue;
	limitations: string[];
	terminologyReferences: TerminologyReference[];
	principleReferences: PrincipleReference[];
	counterevidence: Counterevidence[];
	acceptanceCriteria: AcceptanceCriterion[];
	durability: DurabilityAssessment;
	methodologicalCaveats?: MethodologicalCaveats;
	accessibility: AccessibilityConsiderations;
	targetDocument: TargetDocumentReference;
	uniquenessStatus: UniquenessStatus;
	historicalProposalReferences: HistoricalProposalReference[];
}

// ============================================================================
// Book Delta Engine
// ============================================================================

export class BookDeltaEngine {
	private config: BookDeltaEngineConfig;
	private llmClient: FreeLLMClient | null = null;
	/** Concepts blocked because they duplicate a rejected proposal without new justification. */
	private blockedReintroductions: string[] = [];
	/** True when model-assisted discovery completed successfully at least once. */
	private modelAssessmentUsed = false;
	/** Measurable inference usage for the research-audit report. */
	private modelRequests = 0;
	private modelTokensUsed = 0;
	/** Candidates dropped by the per-edition cap; reported, never silently lost. */
	private droppedCandidateCount = 0;
	/** Monotonic counter guaranteeing unique revision IDs within a run. */
	private revisionCounter = 0;
	/** Proposal identities known before this run — used to separate new from updated. */
	private knownProposalIdsBefore = new Set<string>();
	/** Verified persistence of this run's proposals (independent readback). */
	private persistenceVerified = false;
	/** Verified readback of the persisted register artifact. */
	private readbackVerified = false;

	constructor(config: BookDeltaEngineConfig) {
		this.config = {
			...DEFAULT_BOOK_DELTA_CONFIG,
			...config,
		} as BookDeltaEngineConfig;

		if (
			this.config.enableModelAssistedDiscovery &&
			!this.config.llmClient
		) {
			this.llmClient = createFreeLLMClient();
		} else if (this.config.llmClient) {
			this.llmClient = this.config.llmClient;
		}
	}

	/**
	 * Main entry point: run the Book Delta evaluation for an edition.
	 */
	async run(): Promise<{
		proposals: BookDeltaProposal[];
		artifact: BookDeltaArtifact;
		evaluationResult: BookDeltaEvaluationResult;
		knowledgeContinuityResult: BookDeltaKnowledgeContinuityResult;
		modelRequests: number;
		tokensUsed: number;
		droppedCandidateCount: number;
	}> {
		const startTime = Date.now();
		const editionDate = this.config.editionDate;
		const editionId = `edition_${editionDate}`;

		// Snapshot the pre-existing register so new vs. strengthened proposals can
		// be reported accurately in the research audit.
		const priorProposals = await readAllProposalsAcrossEditions();
		this.knownProposalIdsBefore = new Set(
			priorProposals.map((p) => p.proposalId),
		);

		// Step 1: Extract candidate findings from the fact dossier
		const candidateFindings = this.extractCandidateFindings();

		// Step 2: Identify findings with enduring educational value
		const educationallyValuableFindings =
			await this.identifyEducationallyValuableFindings(candidateFindings);

		// Step 3: Generate proposal candidates
		const proposalCandidates = await this.generateProposalCandidates(
			educationallyValuableFindings,
		);

		// Step 4: Check uniqueness against historical proposals
		const deduplicatedCandidates =
			await this.deduplicateProposals(proposalCandidates);

		// Step 5: Inspect target documents when accessible
		const inspectedCandidates = await this.inspectTargetDocuments(
			deduplicatedCandidates,
		);

		// Step 6: Create formal proposals (stable IDs; merges strengthen existing)
		const proposals = await this.createProposals(
			inspectedCandidates,
			editionId,
			editionDate,
		);

		// Step 7: Limit to max proposals. Dropped candidates are counted and
		// reported in the evaluation result rather than silently discarded.
		const limitedProposals = proposals.slice(
			0,
			this.config.maxProposalsPerEdition,
		);
		this.droppedCandidateCount = Math.max(
			0,
			proposals.length - limitedProposals.length,
		);

		// Step 8: Build the complete register artifact (current edition proposals
		// plus carried-forward historical proposals; historical files are never
		// rewritten).
		const completeRegister = mergeProposalsById(
			priorProposals,
			limitedProposals,
		);
		const artifact = await this.buildArtifact(
			editionDate,
			completeRegister,
			limitedProposals,
		);

		// Step 9: Persist this edition's proposals and the derived artifact
		await this.persistResults(editionDate, limitedProposals, artifact);

		// Independent readback verification: persistence claims in the research
		// audit are never asserted without re-reading the persisted documents.
		await this.verifyPersistence(editionDate, limitedProposals);

		// Step 10: Update historical index (statuses only; original editions kept)
		await updateHistoricalProposalsIndex(editionDate, limitedProposals);

		// Step 11: Create evaluation result
		const evaluationResult = this.createEvaluationResult(
			editionId,
			editionDate,
			limitedProposals,
			startTime,
		);

		// Step 12: Create knowledge continuity result
		const knowledgeContinuityResult = this.createKnowledgeContinuityResult(
			editionId,
			editionDate,
			limitedProposals,
			startTime,
		);

		// Persist evaluation and knowledge continuity results
		await persistBookDeltaEvaluationResult(editionDate, evaluationResult);
		await persistBookDeltaKnowledgeContinuityResult(
			editionDate,
			knowledgeContinuityResult,
		);

		return {
			proposals: limitedProposals,
			artifact,
			evaluationResult,
			knowledgeContinuityResult,
			modelRequests: this.modelRequests,
			tokensUsed: this.modelTokensUsed,
			droppedCandidateCount: this.droppedCandidateCount,
		};
	}

	/**
	 * Extract candidate findings from the canonical fact dossier.
	 */
	private extractCandidateFindings(): CandidateFinding[] {
		const findings: CandidateFinding[] = [];

		for (const candidate of this.config.factDossier.candidates) {
			for (const claim of candidate.claims) {
				// Only consider verified or research findings with sufficient confidence
				if (
					claim.evidenceClassification === "VERIFIED_FACT" ||
					claim.evidenceClassification === "RESEARCH_FINDING" ||
					claim.evidenceClassification === "ORIGINAL_REPORTING"
				) {
					if (
						claim.confidence >= this.config.minConfidenceForProposal
					) {
						findings.push({
							candidateId: candidate.candidateId,
							claimId: claim.claimId,
							claimStatement: claim.claimStatement,
							claimType: claim.claimType,
							evidenceClassification:
								claim.evidenceClassification,
							verificationStatus: claim.verificationStatus,
							verificationLevel: claim.verificationLevel,
							confidence: claim.confidence,
							sourceIds: candidate.sources.map((s) => s.sourceId),
							sourceUrls: candidate.sources.map(
								(s) => s.canonicalUrl,
							),
							sources: candidate.sources,
							researchDomains: candidate.researchDomains,
							organizations: candidate.organizations,
							technologies: candidate.technologies,
							factualHeadline: candidate.factualHeadline,
							exactStatement: candidate.exactStatement,
							limitingEvidence: claim.limitingEvidence,
							timestamps: candidate.timestamps,
							discoveryRingFallback: candidate.discoveryRings[0],
						});
					}
				}
			}
		}

		return findings;
	}

	/**
	 * Identify findings with enduring educational value.
	 * Distinguishes novel knowledge from temporary release information.
	 */
	private async identifyEducationallyValuableFindings(
		findings: CandidateFinding[],
	): Promise<CandidateFinding[]> {
		const valuable: CandidateFinding[] = [];

		for (const finding of findings) {
			// Filter out transient product announcements, version bumps, etc.
			if (this.isTransientFinding(finding)) {
				continue;
			}

			// Check for enduring educational characteristics
			if (this.hasEnduringEducationalValue(finding)) {
				valuable.push(finding);
			}
		}

		// If model-assisted discovery is enabled, use LLM to assess educational value
		if (
			this.config.enableModelAssistedDiscovery &&
			this.llmClient &&
			valuable.length > 0
		) {
			const modelAssessed =
				await this.assessEducationalValueWithModel(valuable);
			return modelAssessed;
		}

		return valuable;
	}

	/**
	 * Check if a finding is transient (product announcement, version bump, etc.).
	 */
	private isTransientFinding(finding: CandidateFinding): boolean {
		const transientClaimTypes = [
			"software-release",
			"vendor-announcement",
			"technical-announcement",
		];

		if (transientClaimTypes.includes(finding.claimType)) {
			// Check if it's just a version bump without architectural significance
			const transientPatterns = [
				/version\s+\d+(\.\d+)+/i,
				/v\d+(\.\d+)+/i,
				/release\s+\d+(\.\d+)+/i,
				/now available/i,
				/announces?/i,
				/launches?/i,
			];

			const text = `${finding.factualHeadline} ${finding.exactStatement} ${finding.claimStatement}`;
			if (transientPatterns.some((p) => p.test(text))) {
				// Check for counter-indicators of architectural significance
				const significancePatterns = [
					/architectur/i,
					/pattern/i,
					/trade.?off/i,
					/scalab/i,
					/security/i,
					/performance/i,
					/cost/i,
					/governance/i,
					/compliance/i,
					/reliability/i,
					/observability/i,
				];

				if (!significancePatterns.some((p) => p.test(text))) {
					return true;
				}
			}
		}

		return false;
	}

	/**
	 * Check if a finding has enduring educational value.
	 */
	private hasEnduringEducationalValue(finding: CandidateFinding): boolean {
		const enduringPatterns = [
			// Technical mechanisms
			/mechanism/i,
			/architecture/i,
			/pattern/i,
			/trade.?off/i,
			/constraint/i,
			/principle/i,
			/design/i,
			/approach/i,
			/method/i,
			/technique/i,
			/strategy/i,

			// Scientific findings
			/finding/i,
			/discovery/i,
			/evidence/i,
			/study/i,
			/research/i,
			/experiment/i,
			/benchmark/i,
			/evaluation/i,
			/measurement/i,

			// Strategic/Economic
			/adoption/i,
			/organizational/i,
			/economic/i,
			/cost/i,
			/roi/i,
			/productivity/i,
			/workforce/i,
			/governance/i,
			/policy/i,
			/regulation/i,
			/compliance/i,
			/risk/i,

			// Security
			/vulnerabilit/i,
			/exploit/i,
			/attack/i,
			/threat/i,
			/mitigation/i,
			/defense/i,
			/sandbox/i,
			/isolation/i,
			/supply.?chain/i,

			// Learning concepts
			/misconception/i,
			/myth/i,
			/misunderstood/i,
			/clarif/i,
			/explain/i,
			/illustrat/i,
			/example/i,
			/prerequisite/i,
			/dependenc/i,
		];

		const text = `${finding.factualHeadline} ${finding.exactStatement} ${finding.claimStatement} ${finding.researchDomains.join(" ")}`;

		return enduringPatterns.some((p) => p.test(text));
	}

	/**
	 * Use LLM to assess educational value of findings.
	 */
	private async assessEducationalValueWithModel(
		findings: CandidateFinding[],
	): Promise<CandidateFinding[]> {
		if (!this.llmClient) return findings;

		try {
			const prompt = this.buildEducationalValuePrompt(findings);
			const response = await this.llmClient.request(
				[
					{
						role: "system",
						content:
							"You are an expert in technical education and knowledge management. Assess which research findings have enduring educational value for system architects and principal engineers.",
					},
					{ role: "user", content: prompt },
				],
				{ temperature: 0, maxTokens: 2048, seed: 42 },
			);

			// Parse response to filter findings
			const selectedIds = this.parseEducationalValueResponse(
				response.content,
				findings,
			);
			this.modelAssessmentUsed = true;
			this.modelRequests += 1;
			this.modelTokensUsed += response.tokensUsed.total;
			return findings.filter((f) => selectedIds.includes(f.claimId));
		} catch (error) {
			console.warn(
				"Model-assisted educational value assessment failed:",
				error,
			);
			return findings;
		}
	}

	/**
	 * Build prompt for educational value assessment.
	 */
	private buildEducationalValuePrompt(findings: CandidateFinding[]): string {
		const findingsText = findings
			.map(
				(f, i) => `
${i + 1}. Claim ID: ${f.claimId}
   Type: ${f.claimType}
   Statement: ${f.claimStatement}
   Classification: ${f.evidenceClassification}
   Confidence: ${f.confidence}
   Domains: ${f.researchDomains.join(", ")}
   Headline: ${f.factualHeadline}
`,
			)
			.join("\n");

		return `
Given the following verified research findings, identify which have ENDURING EDUCATIONAL VALUE for system architects and principal engineers.

Enduring educational value means:
- Conceptual importance for progressive learning
- Technical accuracy that reveals underlying mechanisms
- Reusability across multiple engineering/research contexts
- Relevance beyond one product or release
- Potential to correct recurring misconceptions
- Practical applicability for architectural decision-making

Transient findings (NO enduring value):
- Product version announcements without architectural significance
- Vendor marketing claims without independent verification
- Temporary pricing or availability changes
- Minor feature additions without conceptual depth

Findings:
${findingsText}

Respond with a JSON array of claim IDs that have enduring educational value.
Example: ["claim_abc123", "claim_def456"]
`.trim();
	}

	/**
	 * Parse the model response for educational value assessment.
	 */
	private parseEducationalValueResponse(
		response: string,
		findings: CandidateFinding[],
	): string[] {
		try {
			const match = response.match(/\[[\s\S]*\]/);
			if (match) {
				const ids = JSON.parse(match[0]);
				if (Array.isArray(ids)) {
					return ids.filter(
						(id) =>
							typeof id === "string" &&
							findings.some((f) => f.claimId === id),
					);
				}
			}
		} catch {}
		return findings.map((f) => f.claimId); // Default: keep all
	}

	/**
	 * Generate proposal candidates from educationally valuable findings.
	 */
	private async generateProposalCandidates(
		findings: CandidateFinding[],
	): Promise<ProposalCandidate[]> {
		const candidates: ProposalCandidate[] = [];

		// Group findings by research domain and target concept
		const grouped = this.groupFindingsByConcept(findings);

		for (const [concept, conceptFindings] of Object.entries(grouped)) {
			const candidate = await this.formulateProposal(
				concept,
				conceptFindings ?? [],
			);
			if (candidate) {
				candidates.push(candidate);
			}
		}

		return candidates;
	}

	/**
	 * Group findings by potential educational concept.
	 */
	private groupFindingsByConcept(
		findings: CandidateFinding[],
	): Partial<Record<string, CandidateFinding[]>> {
		// Group by key concept extracted from claim statement and research domains.
		return Object.groupBy(findings, (finding) =>
			this.extractKeyConcept(finding),
		);
	}

	/**
	 * Extract a key educational concept from a finding.
	 */
	private extractKeyConcept(finding: CandidateFinding): string {
		// Use the first research domain as primary concept, refined by claim type
		const domain = finding.researchDomains[0] || "general";
		const claimType = finding.claimType.replace(/-/g, " ");

		// Combine into a concept identifier
		return `${domain}: ${claimType} - ${finding.claimStatement.slice(0, 80)}`;
	}

	/**
	 * Formulate a proposal candidate from grouped findings.
	 */
	private async formulateProposal(
		concept: string,
		findings: CandidateFinding[],
	): Promise<ProposalCandidate | null> {
		if (findings.length === 0) return null;

		// Determine the best category based on the nature of findings
		const category = this.determineCategory(findings);

		// Build supporting evidence
		const supportingClaimIds = findings.map((f) => f.claimId);
		const sourceMap = new Map<string, AuthoritativeSourceReference>();
		for (const finding of findings) {
			for (const source of finding.sources) {
				// Preserve authoritative provenance exactly as recorded in the fact
				// dossier. Never invent a tier, URL or retrieval status.
				const tier = source.tier ?? finding.discoveryRingFallback;
				if (!tier) continue; // Schema requires a tier; skip untraceable sources.
				if (!sourceMap.has(source.sourceId)) {
					sourceMap.set(source.sourceId, {
						sourceId: source.sourceId,
						url: source.canonicalUrl,
						title: source.title ?? finding.factualHeadline,
						tier,
						accessedAt:
							source.accessedAt ??
							finding.timestamps.retrievalTimestamp,
						retrievalStatus: source.retrievalStatus,
						confidence: finding.confidence,
					});
				}
			}
		}
		const originalSources = [...sourceMap.values()];

		// Determine research date range from traceable timestamps only.
		const candidateDates = findings
			.map(
				(f) =>
					f.timestamps.originalPublicationTimestamp ??
					f.timestamps.earliestSupportedPublicDisclosureTimestamp ??
					f.timestamps.underlyingEventDate,
			)
			.filter(
				(d): d is string =>
					typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d),
			)
			.map((d) => d.slice(0, 10))
			.sort();
		const earliestFinding = candidateDates[0] ?? this.config.editionDate;
		const latestFinding =
			candidateDates[candidateDates.length - 1] ??
			this.config.editionDate;
		const researchDates: ResearchDateRange = {
			earliestFinding,
			latestFinding,
			primaryEditionDates: [this.config.editionDate],
		};

		// Determine evidence classification (highest among findings)
		const evidenceClassification =
			this.determineEvidenceClassification(findings);

		// Confidence is the average
		const confidence =
			findings.reduce((sum, f) => sum + f.confidence, 0) /
			findings.length;

		// Material uncertainty
		const materialUncertainty = this.assessMaterialUncertainty(findings);

		// Educational value
		const educationalValue = this.assessEducationalValue(findings);

		// Target concept
		const targetConcept = this.deriveTargetConcept(concept, findings);

		// Title
		const title: BilingualString = {
			en: this.generateTitle(targetConcept, category, "en"),
			nl: this.generateTitle(targetConcept, category, "nl"),
		};

		// Current gap
		const currentGap: BilingualString = {
			en: this.describeCurrentGap(findings, "en"),
			nl: this.describeCurrentGap(findings, "nl"),
		};

		// Proposed change
		const proposedChange: BilingualString = {
			en: this.describeProposedChange(findings, category, "en"),
			nl: this.describeProposedChange(findings, category, "nl"),
		};

		// Rationale
		const rationale: BilingualString = {
			en: this.generateRationale(findings, "en"),
			nl: this.generateRationale(findings, "nl"),
		};

		// Limitations
		const limitations = this.identifyLimitations(findings);

		// Terminology references
		const terminologyReferences =
			await this.findTerminologyReferences(findings);

		// Principle references
		const principleReferences =
			await this.findPrincipleReferences(findings);

		// Counterevidence
		const counterevidence = this.identifyCounterevidence(findings);

		// Acceptance criteria
		const acceptanceCriteria = this.generateAcceptanceCriteria(
			category,
			targetConcept,
		);

		// Durability
		const durability = this.assessDurability(findings);

		// Methodological caveats
		const methodologicalCaveats =
			this.extractMethodologicalCaveats(findings);

		// Accessibility
		const accessibility = this.assessAccessibility(category);

		// Target document (attempt to inspect project-local educational material)
		const targetDocument = await this.findTargetDocument(targetConcept);

		// Check uniqueness against the persisted historical register. This is a
		// conceptual/identity comparison; deterministic text matching alone never
		// proves semantic novelty.
		const uniquenessCheck = await checkProposalUniqueness(
			targetConcept,
			category,
		);
		const existingProposals = await readAllProposalsAcrossEditions();
		const normalizedConcept = normalizeConcept(targetConcept);
		const exactMatch = existingProposals.find(
			(p) =>
				p.category === category &&
				normalizeConcept(p.targetConcept) === normalizedConcept,
		);

		let uniquenessStatus: UniquenessStatus =
			uniquenessCheck.uniquenessStatus;
		if (exactMatch) {
			uniquenessStatus =
				exactMatch.lifecycleStatus === "REJECTED"
					? "duplicate"
					: "strengthens-existing";
		}

		// A rejected historical proposal may not be silently reintroduced. Without
		// materially new evidence the candidate is dropped and recorded as blocked.
		if (
			uniquenessStatus === "duplicate" &&
			exactMatch?.lifecycleStatus === "REJECTED"
		) {
			this.blockedReintroductions.push(
				`${targetConcept}: rejected proposal ${exactMatch.proposalId} reintroduced without documented new justification`,
			);
			return null;
		}

		const historicalProposalReferences = uniquenessCheck.relatedProposals
			.slice(0, 5)
			.map((ref) => ({
				proposalId: ref.proposalId,
				editionDate: ref.editionDate,
				relationship:
					ref.proposalId ===
					uniquenessCheck.strongestMatch?.proposalId
						? uniquenessStatus
						: "links-related",
				resolutionNote:
					ref.proposalId === exactMatch?.proposalId
						? "Exact concept identity match with persisted proposal"
						: undefined,
			}));

		return {
			category,
			targetConcept,
			title,
			currentGap,
			proposedChange,
			rationale,
			supportingClaimIds,
			originalSources: originalSources.slice(0, 10), // Limit sources
			researchDates,
			evidenceClassification,
			confidence,
			materialUncertainty,
			educationalValue,
			limitations,
			terminologyReferences,
			principleReferences,
			counterevidence,
			acceptanceCriteria,
			durability,
			methodologicalCaveats,
			accessibility,
			targetDocument,
			uniquenessStatus,
			historicalProposalReferences,
		};
	}

	/**
	 * Determine the proposal category based on findings.
	 */
	private determineCategory(findings: CandidateFinding[]): BookDeltaCategory {
		const claimTypes = new Set(findings.map((f) => f.claimType));
		const evidenceClasses = new Set(
			findings.map((f) => f.evidenceClassification),
		);

		// Check for correction need (contradicted evidence)
		const hasContradicted = findings.some(
			(f) => f.verificationStatus === "contradicted",
		);
		if (hasContradicted) return "CORRECT";

		// Check for missing concept (no existing coverage)
		const isNewDomain = findings.some((f) =>
			f.researchDomains.some(
				(d) => d.includes("emerging") || d.includes("breakthrough"),
			),
		);
		if (isNewDomain && evidenceClasses.has("RESEARCH_FINDING"))
			return "ADD";

		// Check for deprecation (outdated findings)
		const hasOutdated = findings.some(
			(f) =>
				f.claimStatement.includes("deprecat") ||
				f.claimStatement.includes("obsolete"),
		);
		if (hasOutdated) return "DEPRECATE";

		// Category is derived from the qualitative shape of the evidence, never
		// from the raw finding count: accumulating identical evidence must not
		// change the proposal's category or stable identifier.
		if (claimTypes.size > 1 && findings.length > 1) return "RESTRUCTURE";
		if (evidenceClasses.size > 1 && evidenceClasses.has("RESEARCH_FINDING"))
			return "EXTEND";

		// Default to refine for improving existing explanations
		return "REFINE";
	}

	/**
	 * Determine overall evidence classification.
	 */
	private determineEvidenceClassification(
		findings: CandidateFinding[],
	): EvidenceClassification {
		const hierarchy: EvidenceClassification[] = [
			"VERIFIED_FACT",
			"RESEARCH_FINDING",
			"ORIGINAL_REPORTING",
			"EXPERT_INTERPRETATION",
			"VENDOR_CLAIM",
			"INFERENCE",
			"SPECULATION",
			"UNVERIFIED",
		];

		for (const cls of hierarchy) {
			if (findings.some((f) => f.evidenceClassification === cls)) {
				return cls;
			}
		}
		return "UNVERIFIED";
	}

	/**
	 * Assess material uncertainty.
	 */
	private assessMaterialUncertainty(
		findings: CandidateFinding[],
	): MaterialUncertainty {
		const statuses = findings.map((f) => f.verificationStatus);
		const levels = findings.map((f) => f.verificationLevel);

		if (
			statuses.includes("contradicted") ||
			statuses.includes("insufficient-evidence")
		) {
			return "high";
		}
		if (
			statuses.includes("partially-verified") ||
			levels.includes("L0") ||
			levels.includes("L1")
		) {
			return "medium";
		}
		if (
			statuses.every((s) => s === "verified") &&
			levels.every((l) => l === "L2" || l === "L3")
		) {
			return "low";
		}
		return "medium";
	}

	/**
	 * Assess educational value.
	 */
	private assessEducationalValue(
		findings: CandidateFinding[],
	): EducationalValue {
		const domains = new Set(findings.flatMap((f) => f.researchDomains));
		const claimTypes = new Set(findings.map((f) => f.claimType));

		// Foundational: multiple domains, research findings, high confidence
		if (
			domains.size >= 2 &&
			claimTypes.has("scientific-research") &&
			findings.every((f) => f.confidence > 0.8)
		) {
			return "foundational";
		}

		// Significant: architectural/security/governance domains
		const significantDomains = [
			"architecture-security-governance",
			"agentic-ai-software-engineering",
			"models-inference-scientific",
		];
		if (Array.from(domains).some((d) => significantDomains.includes(d))) {
			return "significant";
		}

		// Niche: very specific product or vendor
		if (domains.size === 1 && claimTypes.has("software-release")) {
			return "niche";
		}

		return "supplementary";
	}

	/**
	 * Derive target concept from grouped findings.
	 */
	private deriveTargetConcept(
		concept: string,
		findings: CandidateFinding[],
	): string {
		// Extract the core concept from the first finding's claim
		const primary = findings[0];
		const statement = primary.claimStatement;

		// Try to extract a clean concept name
		const words = statement.split(/\s+/).slice(0, 10).join(" ");
		return words.length > 100 ? words.slice(0, 100) + "..." : words;
	}

	/**
	 * Generate title for the proposal.
	 */
	private generateTitle(
		targetConcept: string,
		category: BookDeltaCategory,
		lang: "en" | "nl",
	): string {
		const prefixes: Record<BookDeltaCategory, { en: string; nl: string }> =
			{
				ADD: {
					en: "Add Missing Explanation: ",
					nl: "Voeg Ontbrekende Uitleg Toe: ",
				},
				REFINE: { en: "Refine Explanation: ", nl: "Verbeter Uitleg: " },
				CORRECT: {
					en: "Correct Misconception: ",
					nl: "Corrigeer Misverstand: ",
				},
				EXTEND: {
					en: "Extend Coverage: ",
					nl: "Uitgebreide Dekking: ",
				},
				RESTRUCTURE: {
					en: "Restructure Learning Sequence: ",
					nl: "Herstructureer Leervolgorde: ",
				},
				DEPRECATE: {
					en: "Deprecate Outdated Content: ",
					nl: "Afschaffen Verouderde Inhoud: ",
				},
				NONE: {
					en: "No Improvement Proposed",
					nl: "Geen Verbetering Voorgesteld",
				},
			};

		if (category === "NONE") {
			return prefixes[category][lang];
		}

		const prefix = prefixes[category][lang];
		const concept =
			targetConcept.length > 80
				? targetConcept.slice(0, 77) + "..."
				: targetConcept;
		return `${prefix}${concept}`;
	}

	/**
	 * Describe the current knowledge gap.
	 */
	private describeCurrentGap(
		findings: CandidateFinding[],
		lang: "en" | "nl",
	): string {
		const claim = findings[0].claimStatement;
		const domain = findings[0].researchDomains[0];

		if (lang === "nl") {
			return `Huidige uitleg over "${claim.slice(0, 60)}..." in domein "${domain}" is ontoereikend, onjuist of ontbreekt volledig.`;
		}
		return `Current explanation of "${claim.slice(0, 60)}..." in domain "${domain}" is insufficient, incorrect, or missing entirely.`;
	}

	/**
	 * Describe the proposed change.
	 */
	private describeProposedChange(
		findings: CandidateFinding[],
		category: BookDeltaCategory,
		lang: "en" | "nl",
	): string {
		const claim = findings[0].claimStatement.slice(0, 60);

		const templates: Record<BookDeltaCategory, { en: string; nl: string }> =
			{
				ADD: {
					en: `Introduce a new educational section explaining ${claim} with foundational principles, worked examples, and architectural implications.`,
					nl: `Introduceer een nieuwe educatieve sectie die ${claim} uitlegt met fundamentele principes, uitgewerkte voorbeelden en architecturale implicaties.`,
				},
				REFINE: {
					en: `Improve the technical accuracy, clarity, and depth of the existing explanation of ${claim} by adding missing prerequisites, correcting inaccuracies, and providing concrete examples.`,
					nl: `Verbeter de technische nauwkeurigheid, duidelijkheid en diepgang van de bestaande uitleg van ${claim} door ontbrekende vereisten toe te voegen, on nauwkeurigheden te corrigeren en concrete voorbeelden te geven.`,
				},
				CORRECT: {
					en: `Correct the materially incorrect or misleading statement about ${claim} with verified evidence and provide accurate technical explanation.`,
					nl: `Corrigeer de materieel onjuiste of misleidende bewering over ${claim} met geverifieerd bewijs en geef een accurate technische uitleg.`,
				},
				EXTEND: {
					en: `Extend the existing coverage of ${claim} with additional verified evidence, alternative perspectives, limitations, and boundary conditions.`,
					nl: `Breid de bestaande dekking van ${claim} uit met aanvullend geverifieerd bewijs, alternatieve perspectieven, beperkingen en randvoorwaarden.`,
				},
				RESTRUCTURE: {
					en: `Reorganize the educational presentation of ${claim} to establish proper prerequisite dependencies, logical sequencing, and progressive disclosure.`,
					nl: `Herorganiseer de educatieve presentatie van ${claim} om juiste vereiste afhankelijkheden, logische volgorde en progressieve openbaarmaking te etablieren.`,
				},
				DEPRECATE: {
					en: `Mark the outdated explanation of ${claim} as deprecated and replace with current verified understanding.`,
					nl: `Markeer de verouderde uitleg van ${claim} als afgeschreven en vervang door huidige geverifieerde kennis.`,
				},
				NONE: {
					en: "No actionable improvement proposed.",
					nl: "Geen uitvoerbare verbetering voorgesteld.",
				},
			};

		return templates[category][lang];
	}

	/**
	 * Generate rationale for the proposal.
	 */
	private generateRationale(
		findings: CandidateFinding[],
		lang: "en" | "nl",
	): string {
		const count = findings.length;
		const domains = [
			...new Set(findings.flatMap((f) => f.researchDomains)),
		].join(", ");
		const evidence = [
			...new Set(findings.map((f) => f.evidenceClassification)),
		].join(", ");
		const avgConfidence = (
			findings.reduce((s, f) => s + f.confidence, 0) / count
		).toFixed(2);

		if (lang === "nl") {
			return `Op basis van ${count} geverifieerde bevinding(en) in domein(en) ${domains} met bewijsklassificaties ${evidence} en gemiddelde betrouwbaarheid ${avgConfidence}. Deze bevindingen rechtvaardigen een educatieve verbetering vanwege hun duurzame leerwaarde voor systeemarchitecten.`;
		}
		return `Based on ${count} verified finding(s) in domain(s) ${domains} with evidence classifications ${evidence} and average confidence ${avgConfidence}. These findings justify an educational improvement due to their enduring learning value for system architects.`;
	}

	/**
	 * Identify limitations.
	 */
	private identifyLimitations(findings: CandidateFinding[]): string[] {
		const limitations: string[] = [];

		const statuses = findings.map((f) => f.verificationStatus);
		if (statuses.includes("partially-verified")) {
			limitations.push(
				"Some supporting evidence is only partially verified",
			);
		}
		if (statuses.includes("unverified")) {
			limitations.push("Some claims lack full independent verification");
		}

		const levels = findings.map((f) => f.verificationLevel);
		if (levels.includes("L0")) {
			limitations.push(
				"Includes claims at verification level L0 (unverified)",
			);
		}
		if (levels.includes("L1")) {
			limitations.push(
				"Includes claims at verification level L1 (methodology review only)",
			);
		}

		const domains = new Set(findings.flatMap((f) => f.researchDomains));
		if (domains.size === 1) {
			limitations.push(
				"Findings limited to a single research domain; cross-domain applicability not established",
			);
		}

		const organizations = new Set(findings.flatMap((f) => f.organizations));
		if (organizations.size === 1) {
			limitations.push(
				"Evidence primarily from a single organization; vendor independence not fully established",
			);
		}

		return limitations;
	}

	/**
	 * Find relevant terminology references.
	 */
	private async findTerminologyReferences(
		findings: CandidateFinding[],
	): Promise<TerminologyReference[]> {
		const references: TerminologyReference[] = [];

		// Extract key terms from findings, retaining the claim that mentions each term.
		const terms = new Map<string, string>();
		for (const finding of findings) {
			const words = finding.claimStatement.split(/\s+/);
			for (const word of words) {
				if (word.length > 4 && /^[A-Z]/.test(word)) {
					const term = word.toLowerCase();
					if (!terms.has(term)) terms.set(term, finding.claimId);
				}
			}
		}

		// Match against thesaurus
		for (const entry of this.config.thesaurusEntries) {
			const canonical = entry.canonicalTerm.toLowerCase();
			const aliases = [
				...(entry.aliases.en ?? []),
				...(entry.aliases.nl ?? []),
			].map((a) => a.toLowerCase());

			for (const [term, claimId] of terms) {
				if (
					canonical.includes(term) ||
					aliases.some((a) => a.includes(term))
				) {
					references.push({
						entryId: entry.entryId,
						term: entry.canonicalTerm,
						relationship: "related-concept",
						note: `Referenced in claim ${claimId}`,
					});
				}
			}
		}

		return references.slice(0, 10);
	}

	/**
	 * Find relevant architecture principle references.
	 */
	private async findPrincipleReferences(
		findings: CandidateFinding[],
	): Promise<PrincipleReference[]> {
		const references: PrincipleReference[] = [];

		for (const principle of this.config.architecturePrinciples) {
			// Check if principle is relevant to findings
			const principleTerms = [
				principle.title.en.toLowerCase(),
				principle.title.nl.toLowerCase(),
				principle.concern.en.toLowerCase(),
				principle.concern.nl.toLowerCase(),
				...principle.qualityAttributes.map((q) => q.toLowerCase()),
			].join(" ");

			for (const finding of findings) {
				const findingTerms = [
					finding.claimStatement.toLowerCase(),
					finding.factualHeadline.toLowerCase(),
					...finding.researchDomains.map((d) => d.toLowerCase()),
					...finding.technologies.map((t) => t.toLowerCase()),
				].join(" ");

				// Simple relevance check
				const principleWords = new Set(
					principleTerms.split(/\s+/).filter((w) => w.length > 3),
				);
				const findingWords = new Set(
					findingTerms.split(/\s+/).filter((w) => w.length > 3),
				);
				const intersection = new Set(
					[...principleWords].filter((x) => findingWords.has(x)),
				);

				if (intersection.size >= 2) {
					references.push({
						principleId: principle.principleId,
						title: principle.title.en,
						relationship: "illustrates",
						note: `Relevant to claim ${finding.claimId} via shared concepts: ${[...intersection].slice(0, 3).join(", ")}`,
					});
				}
			}
		}

		return references.slice(0, 10);
	}

	/**
	 * Identify counterevidence.
	 */
	private identifyCounterevidence(
		findings: CandidateFinding[],
	): Counterevidence[] {
		const counterevidence: Counterevidence[] = [];

		for (const finding of findings) {
			// Check for contradictory evidence in the claim
			if (finding.verificationStatus === "contradicted") {
				const sourceReference = this.counterevidenceSource(
					finding,
					0.5,
				);
				if (sourceReference) {
					counterevidence.push({
						description: `Contradictory evidence found for claim ${finding.claimId}`,
						sourceReference,
						evidenceClassification: "VERIFIED_FACT",
						impact: "contradictory",
						note: "Original claim contradicted by independent source",
					});
				}
			}

			// Preserve limiting evidence recorded on the canonical claim.
			for (const limitation of finding.limitingEvidence) {
				const sourceReference = this.counterevidenceSource(
					finding,
					0.7,
				);
				if (!sourceReference) continue;
				counterevidence.push({
					description: limitation,
					sourceReference,
					evidenceClassification: "RESEARCH_FINDING",
					impact: "limiting",
					note: "Limiting evidence from original claim verification",
				});
			}
		}

		return counterevidence.slice(0, 5);
	}

	/**
	 * Build an authoritative source reference from the canonical claim's first
	 * source. Returns null when no tier can be established — a counterevidence
	 * item is never emitted with an invented source, URL or tier.
	 */
	private counterevidenceSource(
		finding: CandidateFinding,
		confidence: number,
	): AuthoritativeSourceReference | null {
		const source = finding.sources[0];
		if (!source) return null;
		const tier = source.tier ?? finding.discoveryRingFallback;
		if (!tier) return null;
		return {
			sourceId: source.sourceId,
			url: source.canonicalUrl,
			title: source.title ?? finding.factualHeadline,
			tier,
			accessedAt: source.accessedAt ?? new Date().toISOString(),
			retrievalStatus: source.retrievalStatus,
			confidence,
		};
	}

	/**
	 * Generate acceptance criteria.
	 */
	private generateAcceptanceCriteria(
		category: BookDeltaCategory,
		targetConcept: string,
	): AcceptanceCriterion[] {
		const baseCriteria: AcceptanceCriterion[] = [
			{
				criterionId: "evidence-traceability",
				description:
					"Proposal must trace all factual assertions to verified claims in the canonical fact dossier",
				measurable: true,
				verificationMethod: "cross-reference-check",
				evidenceRequired: [
					"Claim IDs from fact dossier",
					"Source URLs",
				],
			},
			{
				criterionId: "educational-clarity",
				description:
					"Proposed explanation must be reviewed for technical accuracy and clarity by a subject matter expert",
				measurable: true,
				verificationMethod: "expert-review",
				evidenceRequired: ["Expert review record", "Clarity metrics"],
			},
		];

		const categoryCriteria: Record<
			BookDeltaCategory,
			AcceptanceCriterion[]
		> = {
			ADD: [
				...baseCriteria,
				{
					criterionId: "prerequisites-defined",
					description:
						"New concept must have explicit prerequisite knowledge defined",
					measurable: true,
					verificationMethod: "content-inspection",
					evidenceRequired: [
						"Prerequisite list",
						"Learning sequence",
					],
				},
				{
					criterionId: "worked-example",
					description:
						"New concept must include at least one worked example with architectural context",
					measurable: true,
					verificationMethod: "content-inspection",
					evidenceRequired: [
						"Worked example",
						"Architectural context",
					],
				},
			],
			REFINE: [
				...baseCriteria,
				{
					criterionId: "accuracy-improved",
					description:
						"Technical inaccuracies in the original explanation must be corrected",
					measurable: true,
					verificationMethod: "technical-validation",
					evidenceRequired: [
						"Before/after comparison",
						"Verification evidence",
					],
				},
				{
					criterionId: "clarity-improved",
					description:
						"Explanation must demonstrate improved clarity (shorter sentences, active voice, defined terms)",
					measurable: true,
					verificationMethod: "accessibility-audit",
					evidenceRequired: [
						"Readability metrics",
						"Term definitions",
					],
				},
			],
			CORRECT: [
				...baseCriteria,
				{
					criterionId: "correction-verified",
					description:
						"Correction must be supported by higher-level verification evidence than the original claim",
					measurable: true,
					verificationMethod: "technical-validation",
					evidenceRequired: [
						"Verification evidence",
						"Counterevidence references",
					],
				},
				{
					criterionId: "misconception-documented",
					description:
						"The misconception being corrected must be explicitly documented",
					measurable: true,
					verificationMethod: "content-inspection",
					evidenceRequired: [
						"Misconception statement",
						"Prevalence evidence",
					],
				},
			],
			EXTEND: [
				...baseCriteria,
				{
					criterionId: "limitations-explicit",
					description:
						"New limitations and boundary conditions must be explicitly stated with evidence",
					measurable: true,
					verificationMethod: "content-inspection",
					evidenceRequired: [
						"Limitation statements",
						"Supporting evidence",
					],
				},
				{
					criterionId: "alternative-perspectives",
					description:
						"Alternative perspectives must be attributed to their sources",
					measurable: true,
					verificationMethod: "cross-reference-check",
					evidenceRequired: [
						"Source attributions",
						"Perspective summaries",
					],
				},
			],
			RESTRUCTURE: [
				...baseCriteria,
				{
					criterionId: "prerequisite-sequence",
					description:
						"Restructured content must have a validated prerequisite dependency graph",
					measurable: true,
					verificationMethod: "expert-review",
					evidenceRequired: [
						"Dependency graph",
						"Sequence validation",
					],
				},
				{
					criterionId: "progressive-disclosure",
					description:
						"Content must implement progressive disclosure for complex topics",
					measurable: true,
					verificationMethod: "accessibility-audit",
					evidenceRequired: [
						"Disclosure structure",
						"Complexity markers",
					],
				},
			],
			DEPRECATE: [
				...baseCriteria,
				{
					criterionId: "obsolescence-proven",
					description:
						"Obsolescence must be demonstrated with current evidence",
					measurable: true,
					verificationMethod: "technical-validation",
					evidenceRequired: [
						"Current evidence",
						"Replacement reference",
					],
				},
				{
					criterionId: "migration-path",
					description:
						"A migration path to current recommended approach must be provided",
					measurable: true,
					verificationMethod: "content-inspection",
					evidenceRequired: [
						"Migration guide",
						"Replacement approach",
					],
				},
			],
			NONE: [
				{
					criterionId: "none-confirmed",
					description:
						"Explicit confirmation that no actionable improvement is supported by evidence",
					measurable: true,
					verificationMethod: "content-inspection",
					evidenceRequired: ["Evaluation record", "Evidence summary"],
				},
			],
		};

		return categoryCriteria[category] || baseCriteria;
	}

	/**
	 * Assess durability.
	 */
	private assessDurability(
		findings: CandidateFinding[],
	): DurabilityAssessment {
		const domains = new Set(findings.flatMap((f) => f.researchDomains));
		const claimTypes = new Set(findings.map((f) => f.claimType));
		const evidenceClasses = new Set(
			findings.map((f) => f.evidenceClassification),
		);

		return {
			conceptualImportance: claimTypes.has("scientific-research")
				? "high"
				: "medium",
			technicalAccuracy: evidenceClasses.has("VERIFIED_FACT")
				? "high"
				: "medium",
			reusability: domains.size > 1 ? "cross-domain" : "domain-specific",
			multiContextRelevance: domains.size > 1,
			prerequisiteDependencies: Array.from(domains),
			likelihoodOfFutureChange: claimTypes.has("software-release")
				? "high"
				: "low",
			authoritativeEvidenceAvailable:
				evidenceClasses.has("VERIFIED_FACT") ||
				evidenceClasses.has("RESEARCH_FINDING"),
			practicalApplicability:
				claimTypes.has("strategic-research") ||
				claimTypes.has("enterprise-adoption")
					? "high"
					: "medium",
			correctsRecurringMisconception: findings.some(
				(f) =>
					f.claimStatement.includes("misconception") ||
					f.claimStatement.includes("myth"),
			),
			progressiveLearningValue: claimTypes.has("scientific-research")
				? "high"
				: "medium",
			maintenanceCostEstimate: claimTypes.has("software-release")
				? "high"
				: "low",
		};
	}

	/**
	 * Extract methodological caveats.
	 */
	private extractMethodologicalCaveats(
		findings: CandidateFinding[],
	): MethodologicalCaveats | undefined {
		const hasStrategic = findings.some(
			(f) =>
				f.claimType === "strategic-research" ||
				f.claimType === "enterprise-adoption",
		);
		const hasBenchmark = findings.some(
			(f) => f.claimType === "benchmark-result",
		);
		const hasVendor = findings.some(
			(f) => f.evidenceClassification === "VENDOR_CLAIM",
		);

		if (!hasStrategic && !hasBenchmark && !hasVendor) {
			return undefined;
		}

		return {
			empiricalVsInterpretation: hasStrategic
				? "Strategic research findings may include interpretive conclusions beyond measured data"
				: undefined,
			correlationVsCausation: hasStrategic
				? "Organizational studies often show correlation; causation claims require careful evaluation"
				: undefined,
			measuredVsForecast: hasStrategic
				? "Some findings may be forecasts rather than measured outcomes"
				: undefined,
			vendorClaimVsIndependent: hasVendor
				? "Vendor claims included; independent verification status varies"
				: undefined,
			experimentalVsProduction: hasBenchmark
				? "Benchmark conditions may not reflect production environments"
				: undefined,
			populationScope: hasStrategic
				? "Study populations may not represent all organizational contexts"
				: undefined,
			generalizabilityLimitations: [
				"Findings may not generalize across all architectural contexts",
				"Vendor-specific implementations may differ",
				"Scale and workload characteristics affect applicability",
			],
			conflictingStudies: [],
		};
	}

	/**
	 * Assess accessibility considerations.
	 */
	private assessAccessibility(
		category: BookDeltaCategory,
	): AccessibilityConsiderations {
		return {
			explicitObjectives: category !== "NONE",
			explicitPrerequisites:
				category === "ADD" || category === "RESTRUCTURE",
			progressiveDisclosure:
				category === "RESTRUCTURE" || category === "EXTEND",
			contextBeforeComplexity: category !== "NONE",
			meaningfulSequencing:
				category === "RESTRUCTURE" || category === "ADD",
			concreteExamples:
				category === "ADD" ||
				category === "REFINE" ||
				category === "EXTEND",
			accurateAnalogies: category === "ADD" || category === "REFINE",
			clearDistinctions:
				category === "CORRECT" || category === "RESTRUCTURE",
			manageableDensity: category !== "NONE",
			independentExploration: category === "ADD" || category === "EXTEND",
			reducedRepetition: category === "RESTRUCTURE",
			cognitiveLoadAssessment: `Proposed ${category.toLowerCase()} operation assessed for cognitive load; ${category === "ADD" ? "new concept requires careful scaffolding" : category === "RESTRUCTURE" ? "reorganization reduces extraneous load" : "refinement targets intrinsic load reduction"}`,
		};
	}

	/**
	 * Find target document for the concept.
	 *
	 * Inspects only project-local educational material. A lexical match records
	 * the destination as accessed but deliberately reports an inconclusive
	 * comparison — deterministic string matching never proves semantic coverage.
	 * No repository document is modified by this inspection.
	 */
	private async findTargetDocument(
		targetConcept: string,
	): Promise<TargetDocumentReference> {
		if (!this.config.enableTargetDocumentInspection) {
			return {
				accessibility: "unidentified",
				comparisonPerformed: false,
				comparisonResult: "not-performed",
				accessNote:
					"Target document inspection disabled by configuration",
			};
		}

		const matches =
			await this.scanProjectEducationalMaterial(targetConcept);
		const inspectedAt = new Date().toISOString();

		if (matches.length === 0) {
			return {
				accessibility: "unidentified",
				comparisonPerformed: false,
				comparisonResult: "not-performed",
				lastAccessedAt: inspectedAt,
				accessNote:
					"Project-local educational material scan found no document addressing this concept; " +
					"no target document was identified and no comparison with existing material was performed",
			};
		}

		const best = matches[0];
		return {
			documentId: best.relativePath,
			documentTitle: best.title,
			sectionPath: best.sectionPath || undefined,
			accessibility: "accessed",
			lastAccessedAt: inspectedAt,
			accessNote:
				`Lexical project-local scan matched ${best.matchedTermCount}/${best.totalTermCount} concept terms; ` +
				"semantic coverage was not established and no defect is confirmed by string matching alone",
			comparisonPerformed: true,
			comparisonResult: "inconclusive",
		};
	}

	/**
	 * Scan project-local educational Markdown material for concept-term overlap.
	 * Deterministic, read-only, and limited to the repository's own content.
	 */
	private async scanProjectEducationalMaterial(
		targetConcept: string,
	): Promise<
		Array<{
			relativePath: string;
			title: string;
			sectionPath: string;
			matchedTermCount: number;
			totalTermCount: number;
			score: number;
		}>
	> {
		const roots = [
			join(ENGINE_ROOT, "src", "content"),
			join(ENGINE_ROOT, "docs"),
			join(ENGINE_ROOT, "editions"),
		];

		const terms = [
			...new Set(
				targetConcept
					.toLowerCase()
					.replace(/[^a-z0-9]+/g, " ")
					.split(" ")
					.filter((term) => term.length > 3),
			),
		];
		if (terms.length === 0) return [];

		const results: Array<{
			relativePath: string;
			title: string;
			sectionPath: string;
			matchedTermCount: number;
			totalTermCount: number;
			score: number;
		}> = [];

		for (const root of roots) {
			let files: string[] = [];
			try {
				files = await listMarkdownFiles(root);
			} catch {
				continue;
			}

			for (const file of files) {
				let content: string;
				try {
					content = await fs.readFile(file, "utf8");
				} catch {
					continue;
				}
				const lower = content.toLowerCase();
				const matchedTerms = terms.filter((term) =>
					lower.includes(term),
				);
				if (matchedTerms.length === 0) continue;

				// Score: coverage of concept terms, plus a small bonus when the terms
				// appear in a heading (more likely to be an actual treatment).
				const headings = content
					.split("\n")
					.filter((line) => line.startsWith("#"));
				const headingText = headings.join("\n").toLowerCase();
				const headingMatches = matchedTerms.filter((term) =>
					headingText.includes(term),
				).length;
				const coverage = matchedTerms.length / terms.length;
				const score = coverage + headingMatches * 0.05;

				const firstHeading =
					headings
						.find((h) => h.trim().length > 0)
						?.replace(/^#+\s*/, "")
						.trim() ?? "";
				const bestHeading =
					headings
						.filter((h) =>
							matchedTerms.some((term) =>
								h.toLowerCase().includes(term),
							),
						)
						.map((h) => h.replace(/^#+\s*/, "").trim())[0] ?? "";

				results.push({
					relativePath: relative(ENGINE_ROOT, file),
					title: firstHeading || relative(ENGINE_ROOT, file),
					sectionPath: bestHeading,
					matchedTermCount: matchedTerms.length,
					totalTermCount: terms.length,
					score,
				});
			}
		}

		return results
			.filter((r) => r.score >= 0.25)
			.sort(
				(a, b) =>
					b.score - a.score ||
					a.relativePath.localeCompare(b.relativePath),
			)
			.slice(0, 5);
	}

	/**
	 * Check uniqueness against historical proposals.
	 */
	private async deduplicateProposals(
		candidates: ProposalCandidate[],
	): Promise<ProposalCandidate[]> {
		const deduplicated: ProposalCandidate[] = [];

		for (const candidate of candidates) {
			// The uniqueness check was already done in formulateProposal
			// But we can do a second pass against already accepted candidates in this batch
			let isDuplicate = false;
			for (const existing of deduplicated) {
				if (
					this.areConceptuallySimilar(
						candidate.targetConcept,
						existing.targetConcept,
					)
				) {
					isDuplicate = true;
					// Merge: strengthen the existing candidate
					existing.supportingClaimIds.push(
						...candidate.supportingClaimIds,
					);
					existing.originalSources.push(...candidate.originalSources);
					existing.uniquenessStatus = "strengthens-existing";
					break;
				}
			}
			if (!isDuplicate) {
				deduplicated.push(candidate);
			}
		}

		return deduplicated;
	}

	/**
	 * Check if two concepts are conceptually similar.
	 */
	private areConceptuallySimilar(
		concept1: string,
		concept2: string,
	): boolean {
		const terms1 = new Set(
			concept1
				.toLowerCase()
				.split(/\s+/)
				.filter((t) => t.length > 3),
		);
		const terms2 = new Set(
			concept2
				.toLowerCase()
				.split(/\s+/)
				.filter((t) => t.length > 3),
		);
		const intersection = new Set([...terms1].filter((x) => terms2.has(x)));
		const union = new Set([...terms1, ...terms2]);
		return union.size > 0 && intersection.size / union.size > 0.6;
	}

	/**
	 * Inspect target documents when accessible.
	 *
	 * Target inspection now happens per candidate in {@link findTargetDocument};
	 * this pass only verifies that each candidate carries an explicit access
	 * status. Candidates without a destination remain explicitly unresolved.
	 */
	private async inspectTargetDocuments(
		candidates: ProposalCandidate[],
	): Promise<ProposalCandidate[]> {
		if (!this.config.enableTargetDocumentInspection) {
			return candidates;
		}

		for (const candidate of candidates) {
			if (!candidate.targetDocument.accessibility) {
				candidate.targetDocument = {
					accessibility: "unidentified",
					comparisonPerformed: false,
					comparisonResult: "not-performed",
					accessNote:
						"No target document identified for this concept",
				};
			}
		}

		return candidates;
	}

	/**
	 * Create formal BookDeltaProposal objects from candidates.
	 */
	private async createProposals(
		candidates: ProposalCandidate[],
		editionId: string,
		editionDate: string,
	): Promise<BookDeltaProposal[]> {
		const proposals: BookDeltaProposal[] = [];
		const now = new Date().toISOString();
		const existingProposals = await readAllProposalsAcrossEditions();
		const existingById = new Map(
			existingProposals.map((p) => [p.proposalId, p]),
		);

		for (const candidate of candidates) {
			if (candidate.category === "NONE") continue;

			// Deterministic identity: the same educational concept keeps one stable
			// proposal identifier across editions instead of being recreated daily.
			const proposalId = await generateDeterministicProposalId(
				candidate.category,
				candidate.targetConcept,
			);
			const existing = existingById.get(proposalId);

			if (existing) {
				// Merge new evidence into the existing proposal. History is preserved
				// through revision entries; unchanged content produces no new record.
				const mergedClaims = [
					...new Set([
						...existing.supportingClaimIds,
						...candidate.supportingClaimIds,
					]),
				];
				const sourceMap = new Map(
					existing.originalSources.map((s) => [s.sourceId, s]),
				);
				for (const source of candidate.originalSources) {
					if (!sourceMap.has(source.sourceId))
						sourceMap.set(source.sourceId, source);
				}
				const mergedSources = [...sourceMap.values()];
				const refMap = new Map(
					existing.historicalProposalReferences.map((r) => [
						r.proposalId,
						r,
					]),
				);
				for (const ref of candidate.historicalProposalReferences) {
					if (!refMap.has(ref.proposalId))
						refMap.set(ref.proposalId, ref);
				}
				const mergedRefs = [...refMap.values()];

				const targetImproved =
					candidate.targetDocument.accessibility === "accessed" &&
					existing.targetDocument?.accessibility !== "accessed";

				const changed =
					mergedClaims.length !==
						existing.supportingClaimIds.length ||
					mergedSources.length !== existing.originalSources.length ||
					mergedRefs.length !==
						existing.historicalProposalReferences.length ||
					targetImproved;

				if (!changed) {
					proposals.push(existing);
					continue;
				}

				this.revisionCounter += 1;
				const fieldsChanged = [
					"supportingClaimIds",
					"originalSources",
					"historicalProposalReferences",
					"updatedAt",
				];
				if (targetImproved) fieldsChanged.push("targetDocument");
				const revision = {
					revisionId: `rev_${now.replace(/[^a-z0-9]/gi, "").toLowerCase()}_${this.revisionCounter}`,
					changedAt: now,
					changedBy: "book-delta-engine",
					previousLifecycleStatus: existing.lifecycleStatus,
					newLifecycleStatus: existing.lifecycleStatus,
					fieldsChanged,
					justification: `Existing proposal strengthened by evidence from edition ${editionId}; no new proposal created`,
					relatedProposalIds: mergedRefs.map((r) => r.proposalId),
				};

				const updated: BookDeltaProposal = {
					...existing,
					supportingClaimIds: mergedClaims,
					originalSources: mergedSources,
					historicalProposalReferences: mergedRefs,
					...(targetImproved
						? { targetDocument: candidate.targetDocument }
						: {}),
					uniquenessStatus: candidate.uniquenessStatus,
					updatedAt: now,
					revisionHistory: [...existing.revisionHistory, revision],
				};
				validateBookDeltaProposal(updated);
				proposals.push(updated);
				continue;
			}

			const proposal: BookDeltaProposal = {
				proposalId,
				editionId,
				editionDate,
				category: candidate.category,
				title: candidate.title,
				knowledgeDomain: this.mapToKnowledgeDomain(candidate),
				targetAudience: this.determineTargetAudience(candidate),
				targetConcept: candidate.targetConcept,
				targetDocument: candidate.targetDocument,
				currentGap: candidate.currentGap,
				proposedChange: candidate.proposedChange,
				rationale: candidate.rationale,
				supportingClaimIds: candidate.supportingClaimIds,
				originalSources: candidate.originalSources,
				researchDates: candidate.researchDates,
				evidenceClassification: candidate.evidenceClassification,
				confidence: candidate.confidence,
				materialUncertainty: candidate.materialUncertainty,
				educationalValue: candidate.educationalValue,
				limitations: candidate.limitations,
				terminologyReferences: candidate.terminologyReferences,
				principleReferences: candidate.principleReferences,
				historicalProposalReferences:
					candidate.historicalProposalReferences,
				conflicts: [],
				counterevidence: candidate.counterevidence,
				acceptanceCriteria: candidate.acceptanceCriteria,
				durability: candidate.durability,
				methodologicalCaveats: candidate.methodologicalCaveats,
				accessibility: candidate.accessibility,
				lifecycleStatus: "CANDIDATE",
				revisionHistory: [],
				uniquenessStatus: candidate.uniquenessStatus,
				schemaVersion: BOOK_DELTA_SCHEMA_VERSION,
				createdAt: now,
				updatedAt: now,
				createdBy: "book-delta-engine",
				tags: [
					candidate.category.toLowerCase(),
					...candidate.targetConcept
						.toLowerCase()
						.split(/\s+/)
						.slice(0, 3),
				],
			};

			// Validate — engine output never bypasses schema validation.
			validateBookDeltaProposal(proposal);
			proposals.push(proposal);
		}

		// If no proposals generated, record an explicit NONE outcome.
		if (proposals.length === 0) {
			const noneConcept = `No actionable educational improvement identified in edition ${editionDate}`;
			const noneProposal: BookDeltaProposal = {
				proposalId: await generateDeterministicProposalId(
					"NONE",
					editionDate,
				),
				editionId,
				editionDate,
				category: "NONE",
				title: {
					en: "No Improvement Proposed",
					nl: "Geen Verbetering Voorgesteld",
				},
				knowledgeDomain: "cross-cutting",
				targetAudience: ["system-architects"],
				targetConcept: noneConcept,
				currentGap: {
					en: "No verified findings with enduring educational value requiring improvement",
					nl: "Geen geverifieerde bevindingen met duurzame leerwaarde die verbetering vereisen",
				},
				proposedChange: {
					en: "No change proposed",
					nl: "Geen wijziging voorgesteld",
				},
				rationale: {
					en: "Evaluation of verified research findings yielded no candidates meeting the threshold for educational improvement proposals",
					nl: "Evaluatie van geverifieerde onderzoeksbevindingen leverde geen kandidaten op die aan de drempel voor educatieve verbetervoorstellen voldoen",
				},
				supportingClaimIds: [],
				originalSources: [],
				researchDates: {
					earliestFinding: editionDate,
					latestFinding: editionDate,
					primaryEditionDates: [editionDate],
				},
				evidenceClassification: "UNVERIFIED",
				confidence: 1.0,
				materialUncertainty: "low",
				educationalValue: "niche",
				limitations:
					this.blockedReintroductions.length > 0
						? [...this.blockedReintroductions]
						: ["No proposals generated"],
				terminologyReferences: [],
				principleReferences: [],
				historicalProposalReferences: [],
				conflicts: [],
				counterevidence: [],
				acceptanceCriteria: [
					{
						criterionId: "none-confirmed",
						description:
							"Explicit confirmation that no actionable improvement is supported by evidence",
						measurable: true,
						verificationMethod: "content-inspection",
						evidenceRequired: [
							"Evaluation record",
							"Evidence summary",
						],
					},
				],
				durability: {
					conceptualImportance: "low",
					technicalAccuracy: "high",
					reusability: "cross-domain",
					multiContextRelevance: false,
					prerequisiteDependencies: [],
					likelihoodOfFutureChange: "low",
					authoritativeEvidenceAvailable: true,
					practicalApplicability: "low",
					correctsRecurringMisconception: false,
					progressiveLearningValue: "low",
					maintenanceCostEstimate: "low",
				},
				accessibility: {
					explicitObjectives: false,
					explicitPrerequisites: false,
					progressiveDisclosure: false,
					contextBeforeComplexity: false,
					meaningfulSequencing: false,
					concreteExamples: false,
					accurateAnalogies: false,
					clearDistinctions: false,
					manageableDensity: true,
					independentExploration: false,
					reducedRepetition: true,
					cognitiveLoadAssessment:
						"NONE proposal - no cognitive load",
				},
				lifecycleStatus: "CANDIDATE",
				revisionHistory: [],
				uniquenessStatus: "unique",
				schemaVersion: BOOK_DELTA_SCHEMA_VERSION,
				createdAt: now,
				updatedAt: now,
				createdBy: "book-delta-engine",
				tags: ["none"],
			};
			validateBookDeltaProposal(noneProposal);
			proposals.push(noneProposal);
		}

		return proposals;
	}

	/**
	 * Map candidate to knowledge domain.
	 */
	private mapToKnowledgeDomain(
		candidate: ProposalCandidate,
	): KnowledgeDomain {
		// Infer from the first finding's research domains
		const domains = candidate.targetConcept;
		if (domains.includes("agentic") || domains.includes("agent"))
			return "agentic-ai-software-engineering";
		if (domains.includes("model") || domains.includes("inference"))
			return "models-inference-scientific";
		if (
			domains.includes("architecture") ||
			domains.includes("security") ||
			domains.includes("governance")
		)
			return "architecture-security-governance";
		if (
			domains.includes("enterprise") ||
			domains.includes("adoption") ||
			domains.includes("organizational")
		)
			return "enterprise-adoption-organizational";
		if (
			domains.includes("economic") ||
			domains.includes("business") ||
			domains.includes("roi")
		)
			return "economics-business-impact";
		return "independent-research-advisory";
	}

	/**
	 * Determine target audience.
	 */
	private determineTargetAudience(
		candidate: ProposalCandidate,
	): TargetAudience[] {
		const audiences: TargetAudience[] = [
			"system-architects",
			"principal-engineers",
		];

		if (candidate.targetConcept.includes("security")) {
			audiences.push("security-architects");
		}
		if (
			candidate.targetConcept.includes("cost") ||
			candidate.targetConcept.includes("economic")
		) {
			audiences.push("cost-engineers");
		}
		if (
			candidate.targetConcept.includes("ml") ||
			candidate.targetConcept.includes("platform")
		) {
			audiences.push("ml-platform-leads");
		}
		if (
			candidate.targetConcept.includes("cto") ||
			candidate.targetConcept.includes("strategic")
		) {
			audiences.push("technical-ctos");
		}

		return audiences;
	}

	/**
	 * Build the Book Delta artifact — the complete derived register.
	 *
	 * `register` contains every known proposal (carried-forward history plus
	 * this edition's updates); `editionProposals` are the proposals created or
	 * strengthened by this run and are reported separately.
	 */
	private async buildArtifact(
		editionDate: string,
		register: BookDeltaProposal[],
		editionProposals: BookDeltaProposal[],
	): Promise<BookDeltaArtifact> {
		const now = new Date().toISOString();
		const artifactId = await generateDeterministicArtifactId(editionDate);
		const previous = await loadExistingArtifact(editionDate);

		// Every category and lifecycle key is present (zero when unused) so the
		// artifact record is complete and deterministic for downstream consumers.
		const byCategory: Record<string, number> = {
			ADD: 0,
			REFINE: 0,
			CORRECT: 0,
			EXTEND: 0,
			RESTRUCTURE: 0,
			DEPRECATE: 0,
			NONE: 0,
		};
		const byLifecycle: Record<string, number> = {
			CANDIDATE: 0,
			READY_FOR_REVIEW: 0,
			APPROVED: 0,
			REJECTED: 0,
			SUPERSEDED: 0,
			IMPLEMENTED: 0,
			VALIDATED: 0,
		};
		const byDomain: Record<string, number> = {};

		for (const p of register) {
			byCategory[p.category] = (byCategory[p.category] || 0) + 1;
			byLifecycle[p.lifecycleStatus] =
				(byLifecycle[p.lifecycleStatus] || 0) + 1;
			byDomain[p.knowledgeDomain] =
				(byDomain[p.knowledgeDomain] || 0) + 1;
		}

		const stats = {
			totalProposals: register.length,
			byCategory,
			byLifecycleStatus: byLifecycle,
			byDomain,
			candidateProposals: byLifecycle["CANDIDATE"] || 0,
			readyForReviewProposals: byLifecycle["READY_FOR_REVIEW"] || 0,
			approvedProposals: byLifecycle["APPROVED"] || 0,
			rejectedProposals: byLifecycle["REJECTED"] || 0,
			supersededProposals: byLifecycle["SUPERSEDED"] || 0,
			implementedProposals: byLifecycle["IMPLEMENTED"] || 0,
			validatedProposals: byLifecycle["VALIDATED"] || 0,
			noneProposals: byCategory["NONE"] || 0,
			proposalsWithTargetDocument: register.filter(
				(p) => p.targetDocument?.accessibility === "accessed",
			).length,
			proposalsWithoutTargetDocument: register.filter(
				(p) => p.targetDocument?.accessibility !== "accessed",
			).length,
			uniqueProposals: register.filter(
				(p) => p.uniquenessStatus === "unique",
			).length,
			strengtheningProposals: register.filter(
				(p) => p.uniquenessStatus === "strengthens-existing",
			).length,
			supersedingProposals: register.filter(
				(p) => p.uniquenessStatus === "supersedes",
			).length,
		};

		const validationResults = [
			{
				rule: "proposal-schema-validation",
				passed: true,
				details: `${editionProposals.length} edition proposal(s) validated against BookDeltaProposalSchema`,
			},
			{
				rule: "stable-proposal-identity",
				passed: editionProposals.every((p) =>
					p.proposalId.startsWith("bdp_"),
				),
				details:
					"Every proposal carries a stable bdp_ identifier derived from category and concept",
			},
			{
				rule: "approval-boundary",
				// The engine never grants approval, implementation or validation status.
				passed: editionProposals.every(
					(p) => p.lifecycleStatus === "CANDIDATE",
				),
				details:
					"All engine-generated proposals remain CANDIDATE pending human review",
			},
		];

		const artifactWithoutHash: Omit<BookDeltaArtifact, "contentHash"> = {
			artifactId,
			schemaVersion: BOOK_DELTA_SCHEMA_VERSION,
			editionDate,
			generatedAt: now,
			generatedBy: "book-delta-engine",
			proposals: register,
			previousVersionHash: previous?.contentHash,
			stats,
			validationResults,
		};

		const contentHash = await computeObjectHash(artifactWithoutHash);

		return {
			...artifactWithoutHash,
			contentHash,
		};
	}

	/**
	 * Persist all results.
	 *
	 * Idempotent: a proposal whose canonical serialized form is already present
	 * at the destination is not rewritten, so repeated runs of the same edition
	 * neither duplicate records nor disturb identical content.
	 */
	private async persistResults(
		editionDate: string,
		proposals: BookDeltaProposal[],
		artifact: BookDeltaArtifact,
	): Promise<void> {
		for (const proposal of proposals) {
			const destination = getProposalPath(
				editionDate,
				proposal.proposalId,
			);
			try {
				const existingContent = await fs.readFile(destination, "utf8");
				if (existingContent === canonicalStringify(proposal)) {
					continue; // Already persisted identically — no write needed.
				}
			} catch {
				// Destination absent or unreadable: fall through and write atomically.
			}
			await persistBookDeltaProposal(editionDate, proposal);
		}

		await persistBookDeltaArtifact(editionDate, artifact);
	}

	/**
	 * Verify persistence by independently reading back every proposal and the
	 * register artifact. A failed readback throws: the engine never reports
	 * persistence success it could not observe.
	 */
	private async verifyPersistence(
		editionDate: string,
		proposals: BookDeltaProposal[],
	): Promise<void> {
		const storedProposals = await readAllProposalsAcrossEditions();
		const storedById = new Map(
			storedProposals.map((p) => [p.proposalId, p]),
		);

		let allPresent = true;
		for (const proposal of proposals) {
			const stored = storedById.get(proposal.proposalId);
			if (!stored || stored.updatedAt !== proposal.updatedAt) {
				allPresent = false;
				break;
			}
		}

		const artifact = await loadExistingArtifact(editionDate);
		const artifactOk =
			artifact !== null && artifact.contentHash.length > "sha256:".length;

		this.persistenceVerified = allPresent;
		this.readbackVerified = artifactOk;

		if (!allPresent || !artifactOk) {
			throw new Error(
				`Book Delta persistence verification failed for ${editionDate}: ` +
					`proposalsPresent=${allPresent}, artifactReadback=${artifactOk}`,
			);
		}
	}

	/**
	 * Create evaluation result for research-audit integration.
	 */
	private createEvaluationResult(
		editionId: string,
		editionDate: string,
		proposals: BookDeltaProposal[],
		startTime: number,
	): BookDeltaEvaluationResult {
		const newProposals = proposals
			.filter(
				(p) =>
					p.category !== "NONE" &&
					!this.knownProposalIdsBefore.has(p.proposalId),
			)
			.map((p) => p.proposalId);
		const noneProposals = proposals.filter(
			(p) => p.category === "NONE",
		).length;
		const gaps = [
			...this.identifyEvidenceGaps(proposals),
			...this.blockedReintroductions,
		];
		if (this.droppedCandidateCount > 0) {
			gaps.push(
				`${this.droppedCandidateCount} candidate(s) dropped by the per-edition proposal cap (${this.config.maxProposalsPerEdition})`,
			);
		}

		let inferenceNote: string;
		if (this.modelAssessmentUsed) {
			inferenceNote = "Model-assisted educational value assessment used";
		} else if (
			this.config.enableModelAssistedDiscovery &&
			this.llmClient !== null
		) {
			inferenceNote =
				"Model-assisted assessment was configured but did not complete successfully; " +
				"deterministic evaluation finished and no inference success is claimed";
		} else {
			inferenceNote =
				"Deterministic evaluation only; no inference requested";
		}

		return {
			editionId,
			editionDate,
			evaluatedAt: new Date().toISOString(),
			evaluatedBy: "book-delta-engine",
			evaluationPerformed: true,
			factDossierConsidered: true,
			thesaurusConsulted: this.config.thesaurusEntries.length > 0,
			architecturePrinciplesConsulted:
				this.config.architecturePrinciples.length > 0,
			historicalProposalsInspected: true,
			targetDocumentsInspected:
				this.config.enableTargetDocumentInspection,
			newProposals,
			updatedHistoricalProposals: proposals
				.filter((p) => this.knownProposalIdsBefore.has(p.proposalId))
				.filter((p) =>
					[
						"strengthens-existing",
						"revises-scope",
						"supersedes",
					].includes(p.uniquenessStatus),
				)
				.map((p) => p.proposalId),
			duplicateProposalsIdentified: proposals
				.filter((p) => p.uniquenessStatus === "duplicate")
				.map((p) => p.proposalId),
			noChangeDecisions: noneProposals,
			unresolvedEvidenceGaps: gaps,
			targetDocumentAccessLimitations: proposals
				.filter((p) => p.targetDocument?.accessibility !== "accessed")
				.map(
					(p) =>
						`${p.proposalId}: ${p.targetDocument?.accessNote || "Target document not accessible"}`,
				),
			reviewRequirements: proposals
				.filter((p) => p.category !== "NONE")
				.flatMap((p) =>
					p.acceptanceCriteria.map(
						(c) => `${p.proposalId}: ${c.criterionId}`,
					),
				),
			persistenceSucceeded: this.persistenceVerified,
			readbackSucceeded: this.readbackVerified,
			inferenceUsed: this.modelAssessmentUsed,
			inferenceNote,
		};
	}

	/**
	 * Identify evidence gaps from proposals.
	 */
	private identifyEvidenceGaps(proposals: BookDeltaProposal[]): string[] {
		const gaps: string[] = [];

		for (const proposal of proposals) {
			if (
				proposal.materialUncertainty === "high" ||
				proposal.materialUncertainty === "speculative"
			) {
				gaps.push(
					`${proposal.proposalId}: High material uncertainty (${proposal.materialUncertainty})`,
				);
			}
			if (
				proposal.evidenceClassification === "VENDOR_CLAIM" ||
				proposal.evidenceClassification === "UNVERIFIED"
			) {
				gaps.push(
					`${proposal.proposalId}: Low evidence classification (${proposal.evidenceClassification})`,
				);
			}
			if (proposal.counterevidence.length > 0) {
				gaps.push(
					`${proposal.proposalId}: ${proposal.counterevidence.length} counterevidence item(s) present`,
				);
			}
			if (proposal.targetDocument?.accessibility !== "accessed") {
				gaps.push(
					`${proposal.proposalId}: Target document not inspected`,
				);
			}
		}

		return gaps;
	}

	/**
	 * Create knowledge continuity result for K gate integration.
	 */
	private createKnowledgeContinuityResult(
		editionId: string,
		editionDate: string,
		proposals: BookDeltaProposal[],
		startTime: number,
	): BookDeltaKnowledgeContinuityResult {
		const proposalCount = proposals.filter(
			(p) => p.category !== "NONE",
		).length;
		const noneCount = proposals.filter((p) => p.category === "NONE").length;
		const limitations = [
			...this.identifyEvidenceGaps(proposals),
			...this.blockedReintroductions,
		];

		return {
			// NONE is a valid outcome, not a failure; only an unexecuted assessment
			// or a verified persistence failure would be non-PASS.
			gateStatus:
				this.persistenceVerified && this.readbackVerified
					? "PASS"
					: "UNVERIFIED",
			editionId,
			editionDate,
			evaluationRan: true,
			evidenceInspected: true,
			candidatesEvaluated: proposalCount > 0 || noneCount > 0,
			proposalsRecorded: proposalCount > 0,
			duplicatesHandled: true,
			persistenceSucceeded: this.persistenceVerified,
			readbackSucceeded: this.readbackVerified,
			limitationsReported: limitations.length > 0,
			unresolvedLimitations: limitations,
			details:
				`Book Delta evaluation completed for ${editionDate}. ${proposalCount} proposal(s) generated, ` +
				`${noneCount} NONE outcome(s). ${this.droppedCandidateCount} candidate(s) dropped by the per-edition cap. ` +
				`${limitations.length} evidence gap(s) reported. ` +
				`Persistence and independent readback verified: ${this.persistenceVerified && this.readbackVerified}.`,
			evaluatedAt: new Date().toISOString(),
			evaluatedBy: "book-delta-engine",
		};
	}
}

/**
 * Factory function to create a BookDeltaEngine.
 */
export function createBookDeltaEngine(
	config: BookDeltaEngineConfig,
): BookDeltaEngine {
	return new BookDeltaEngine(config);
}
