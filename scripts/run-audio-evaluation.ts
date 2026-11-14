#!/usr/bin/env tsx
/**
 * Run Audio A-G Listening Quality Evaluation
 *
 * Evaluates the independently authored Dutch listening narrative against
 * the Audio A-G criteria, complementing the Q1-Q10 evaluation by assessing
 * the complete listening experience as an integrated narrative.
 *
 * Processing sequence:
 *   Q1-Q10 Evaluation → Audio A-G Evaluation → Publication Validation → Deployment
 *
 * Usage:
 *   pnpm exec tsx scripts/run-audio-evaluation.ts --edition 2025-01-15
 *   pnpm exec tsx scripts/run-audio-evaluation.ts --edition 2025-01-15 --demo
 *   pnpm exec tsx scripts/run-audio-evaluation.ts --edition 2025-01-15 --validate-only
 *   pnpm exec tsx scripts/run-audio-evaluation.ts --edition 2025-01-15 --persist
 */

import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

import {
	loadListeningNarrativeGenerationInput,
	generateListeningNarrativeMarkdown,
	type ListeningNarrativeGenerationInput,
	type ListeningNarrativeGenerationResult,
} from "../src/lib/publication/listening-narrative-generator.js";
import {
	evaluateListeningQuality,
	persistEvaluationReport,
	type ListeningQualityEvaluationReport,
	type ListeningQualityEvaluationInput,
} from "../src/lib/listening-quality-evaluation/index.js";
import {
	evaluateAudioQuality,
	persistAudioEvaluationReport,
	type HolisticListeningAssessment,
} from "../src/lib/listening-quality-evaluation/index.js";
import {
	getListeningNarrativePath,
	getCanonicalDir,
} from "../src/lib/publication/paths.js";
import {
	EditionIdentitySchema,
	CanonicalReferencesSchema,
	type EditionIdentity,
	type CanonicalReferences,
} from "../src/lib/publication/schema.js";

const __dirname = join(fileURLToPath(import.meta.url), "..");
const PROJECT_ROOT = join(__dirname, "..");

interface CliOptions {
	edition: string;
	demo?: boolean;
	validateOnly?: boolean;
	persist?: boolean;
	skipQ1Q10?: boolean;
}

function parseCliArgs(): CliOptions {
	const { values, positionals } = parseArgs({
		args: process.argv.slice(2),
		options: {
			edition: { type: "string", short: "e" },
			demo: { type: "boolean" },
			"validate-only": { type: "boolean" },
			persist: { type: "boolean" },
			"skip-q1q10": { type: "boolean" },
		},
		allowPositionals: true,
	});

	if (!values.edition) {
		console.error("Error: --edition is required (format: YYYY-MM-DD)");
		process.exit(1);
	}

	return {
		edition: values.edition,
		demo: values.demo ?? false,
		validateOnly: values["validate-only"] ?? false,
		persist: values.persist ?? false,
		skipQ1Q10: values["skip-q1q10"] ?? false,
	};
}

/**
 * Load synthetic demo data for testing without real research artifacts.
 */
async function loadDemoData(editionDate: string): Promise<{
	editionIdentity: EditionIdentity;
	canonicalReferences: CanonicalReferences;
	listeningNarrativeInput: ListeningNarrativeGenerationInput;
	listeningNarrativeResult: ListeningNarrativeGenerationResult;
}> {
	const editionId = `edition_${editionDate}`;
	const now = new Date().toISOString();

	// Edition window: 05:00 Europe/Amsterdam previous day to 05:00 edition day
	const editionDateObj = new Date(`${editionDate}T05:00:00+01:00`);
	const start = new Date(
		editionDateObj.getTime() - 24 * 60 * 60 * 1000,
	).toISOString();
	const end = editionDateObj.toISOString();

	const editionIdentity: EditionIdentity = {
		editionId,
		editionDate,
		editionWindow: {
			editionDate,
			start,
			end,
			timezone: "Europe/Amsterdam",
			durationHours: 24,
		},
		reportingWindow: {
			start,
			end,
			timezone: "Europe/Amsterdam",
		},
	};

	const canonicalReferences: CanonicalReferences = {
		factDossier: {
			dossierId: `fd_${"a".repeat(16)}`,
			editionId,
			contentHash: `sha256:${"b".repeat(64)}`,
		},
		editorialSelection: {
			manifestId: `esm_${"c".repeat(16)}`,
			editionId,
			contentHash: `sha256:${"d".repeat(64)}`,
		},
		historicalRegression: {
			reportId: `hr_${"e".repeat(16)}`,
			editionId,
			contentHash: `sha256:${"f".repeat(64)}`,
			referenced: true,
		},
		omissionReview: {
			reportId: `or_${"g".repeat(16)}`,
			executionId: `exec_${"h".repeat(16)}`,
			referenced: true,
		},
	};

	// Demo stories (3 selected stories)
	const stories = [
		{
			story: {
				storyId: `story_${"1".repeat(16)}`,
				order: 1,
				title: "OpenAI, GitHub — Foundation Models, Coding Agents",
				candidateId: `cand_${"1".repeat(16)}`,
				mergedCandidateIds: [],
				claimIds: [
					`claim_${"1".repeat(16)}`,
					`claim_${"2".repeat(16)}`,
				],
				sourceIds: ["openai-research", "github-copilot-vscode"],
				organizations: ["OpenAI", "GitHub"],
				researchDomains: ["foundation-models", "coding-agents"],
				discoveryRings: [1, 2],
				materialityScore: 0.85,
				materialityLevel: "high" as const,
				decision: "SELECTED" as const,
				summary:
					"New foundation model capabilities and coding agent background delegation.",
				recommendedDepth: "deep-dive" as const,
				explanationOpportunities: [
					"technical-deep-dive",
					"scientific-explanation",
					"practical-engineering",
					"diagram",
				],
				evidenceClassificationSummary:
					"VERIFIED_FACT (L2), RESEARCH_FINDING (L1)",
				caveats: [
					"Model capabilities based on vendor benchmarks; independent replication pending",
				],
			},
			candidate: {
				candidateId: `cand_${"1".repeat(16)}`,
				editionId,
				editionDate,
				factualHeadline:
					"OpenAI releases o3 with advanced reasoning; GitHub Copilot adds background delegation",
				exactStatement:
					"OpenAI announced o3 model with significant reasoning improvements; GitHub Copilot coding agent now delegates tasks to background agents with checkpointing.",
				researchDomains: ["foundation-models", "coding-agents"],
				subdomainTags: ["DOM-02-SD01", "DOM-01-SD03"],
				discoveryRings: [1, 2],
				organizations: ["OpenAI", "GitHub"],
				products: ["OpenAI o3", "GitHub Copilot coding agent"],
				technologies: [
					"reasoning models",
					"background agents",
					"checkpointing",
				],
				researchProjects: [],
				sources: [
					{
						sourceId: "openai-research",
						canonicalUrl: "https://openai.com/research/o3",
						discoveryIds: [],
						retrievalStatus: "CHECKED_FOUND",
						accessedAt: now,
					},
					{
						sourceId: "github-copilot-vscode",
						canonicalUrl:
							"https://github.blog/changelog/copilot-agent-background",
						discoveryIds: [],
						retrievalStatus: "CHECKED_FOUND",
						accessedAt: now,
					},
				],
				timestamps: {
					originalPublicationTimestamp:
						"2025-01-14T12:00:00+01:00[Europe/Amsterdam]",
					earliestSupportedPublicDisclosureTimestamp:
						"2025-01-14T12:00:00+01:00[Europe/Amsterdam]",
					retrievalTimestamp: now,
					timezone: "Europe/Amsterdam",
					timestampConfidence: 0.95,
					timestampPrecision: "exact",
					timestampAvailability: "available",
				},
				temporalEligibility: {
					status: "NEW_PASS",
					rationale: "New developments within window.",
					noveltyClassification: {
						classification: "NEW",
						editionDate,
						inWindow: true,
						evidence: [],
						reasoning: "New.",
						primaryPublicationTimestamp:
							"2025-01-14T12:00:00+01:00[Europe/Amsterdam]",
						isSubstantiveUpdate: false,
						isNewlyRevealedFact: true,
						confidence: 0.9,
					},
					editionBoundary: {
						start,
						end,
						timezone: "Europe/Amsterdam",
					},
					derivedFrom: "novelty-classification",
					derivedAt: now,
				},
				previousCoverage: [],
				sourceAccessibility: [],
				claims: [
					{
						claimId: `claim_${"1".repeat(16)}`,
						candidateId: `cand_${"1".repeat(16)}`,
						claimStatement:
							"OpenAI o3 achieves 25% improvement on ARC-AGI benchmark.",
						claimType: "benchmark-result",
						evidenceClassification: "VERIFIED_FACT",
						supportingEvidenceUrls: [
							"https://openai.com/research/o3",
						],
						independentCorroboration: {
							established: false,
							sourceIds: [],
							urls: [],
							note: "Pending.",
						},
						contradictoryEvidence: [],
						limitingEvidence: [],
						technicalContext: {
							mechanism:
								"Enhanced chain-of-thought with synthetic reasoning tokens.",
							capabilities: ["reasoning"],
							architecture: ["dense transformer"],
							limitations: ["High compute cost."],
							releaseMaturity: "preview",
							implementationStatus: "preview",
						},
						confidence: 0.85,
						verificationLevel: "L2",
						verificationStatus: "verified",
						verificationRationale:
							"Methodology reviewed, artifact available.",
						verificationMethods: [
							"methodology-review",
							"artifact-reproduction",
						],
						uncertainty: {
							unresolved: [],
							assumptions: [],
							falsificationCriteria: [],
						},
						sourceProvenance: {
							sourceId: "openai-research",
							url: "https://openai.com/research/o3",
							title: "OpenAI o3 Paper",
							publicationTimestamp:
								"2025-01-14T12:00:00+01:00[Europe/Amsterdam]",
							retrievedAt: now,
							verificationTimestamp: now,
							verifiedBy: "test",
						},
						inclusionNote: "Demo fixture.",
					},
					{
						claimId: `claim_${"2".repeat(16)}`,
						candidateId: `cand_${"1".repeat(16)}`,
						claimStatement:
							"GitHub Copilot coding agent delegates tasks to background agents with checkpointing.",
						claimType: "software-release",
						evidenceClassification: "VENDOR_CLAIM",
						supportingEvidenceUrls: [
							"https://github.blog/changelog/copilot-agent-background",
						],
						independentCorroboration: {
							established: false,
							sourceIds: [],
							urls: [],
							note: "Pending.",
						},
						contradictoryEvidence: [],
						limitingEvidence: [],
						technicalContext: {
							mechanism:
								"Background agent delegation with checkpointed sessions.",
							capabilities: [
								"background task delegation",
								"checkpointing",
							],
							architecture: ["multi-agent orchestration"],
							limitations: [
								"Phased rollout to Enterprise first.",
							],
							releaseMaturity: "preview",
							implementationStatus: "preview",
						},
						confidence: 0.7,
						verificationLevel: "L0",
						verificationStatus: "unverified",
						verificationRationale: "Vendor announcement only.",
						verificationMethods: ["primary-source-inspection"],
						uncertainty: {
							unresolved: [],
							assumptions: [],
							falsificationCriteria: [],
						},
						sourceProvenance: {
							sourceId: "github-copilot-vscode",
							url: "https://github.blog/changelog/copilot-agent-background",
							title: "GitHub Copilot Background Delegation",
							publicationTimestamp:
								"2025-01-14T12:00:00+01:00[Europe/Amsterdam]",
							retrievedAt: now,
							verificationTimestamp: now,
							verifiedBy: "test",
						},
						inclusionNote: "Demo fixture.",
					},
				],
				unresolvedQuestions: [],
				evidenceGaps: [],
				editorialReadiness: {
					materialNovelty: {
						level: "high",
						evidence: [],
						traceableTo: [],
					},
					technicalScientificSignificance: {
						level: "high",
						evidence: [],
						traceableTo: [],
					},
					realWorldConsequences: {
						level: "high",
						evidence: [],
						traceableTo: [],
					},
					enterpriseEconomicImplications: {
						level: "medium",
						evidence: [],
						traceableTo: [],
					},
					generalizability: {
						level: "medium",
						evidence: [],
						traceableTo: [],
					},
					evidenceStrength: {
						level: "high",
						evidence: [],
						traceableTo: [],
					},
					evidenceLimitations: {
						level: "medium",
						evidence: [],
						traceableTo: [],
					},
					practicalEngineeringRelevance: {
						level: "high",
						evidence: [],
						traceableTo: [],
					},
					availabilityMaturity: {
						level: "medium",
						evidence: [],
						traceableTo: [],
					},
					potentialOverlap: {
						level: "low",
						evidence: [],
						traceableTo: [],
					},
					selectionNote:
						"Descriptive indicators only — no editorial ranking, quotas, topic weights or publication decisions are made at this stage.",
				},
				processingStatus: "consolidated",
				audit: {
					discoveredAt: now,
					retrievedAt: now,
					noveltyClassifiedAt: now,
					claimsVerifiedAt: now,
					consolidatedAt: now,
					consolidatedBy: "demo",
					revision: 1,
				},
				provenance: {
					discoveryIds: [],
					candidateStableId: `cand_${"1".repeat(16)}`,
					pipeline: [],
					consumedFrom: [],
				},
			},
			assessment: {
				candidateId: `cand_${"1".repeat(16)}`,
				factualHeadline:
					"OpenAI releases o3 with advanced reasoning; GitHub Copilot adds background delegation",
				exactStatement:
					"OpenAI announced o3 model with significant reasoning improvements; GitHub Copilot coding agent now delegates tasks to background agents with checkpointing.",
				organizations: ["OpenAI", "GitHub"],
				products: ["OpenAI o3", "GitHub Copilot coding agent"],
				technologies: [
					"reasoning models",
					"background agents",
					"checkpointing",
				],
				researchDomains: ["foundation-models", "coding-agents"],
				discoveryRings: [1, 2],
				eligibility: {
					candidateId: `cand_${"1".repeat(16)}`,
					state: "ELIGIBLE",
					temporalStatus: "NEW_PASS",
					evidenceSufficiency: "STRONG",
					hasBlockingUncertainty: false,
					noveltyStatementPresent: true,
					historicalRelationship: undefined,
					historicalConfidence: undefined,
					omissionReviewFlags: [],
					reasons: [
						"Major model release, significant coding agent update.",
					],
					traceableTo: [
						`claim_${"1".repeat(16)}`,
						`claim_${"2".repeat(16)}`,
					],
				},
				dimensions: [
					{
						dimension: "material-novelty",
						level: "high",
						score: 0.9,
						evidence: [],
						traceableTo: [],
						weight: 0.2,
						role: "primary",
					},
					{
						dimension: "scientific-technical-significance",
						level: "high",
						score: 0.85,
						evidence: [],
						traceableTo: [],
						weight: 0.2,
						role: "primary",
					},
					{
						dimension: "real-world-consequences",
						level: "high",
						score: 0.8,
						evidence: [],
						traceableTo: [],
						weight: 0.15,
						role: "primary",
					},
					{
						dimension: "strategic-economic-significance",
						level: "medium",
						score: 0.65,
						evidence: [],
						traceableTo: [],
						weight: 0.15,
						role: "primary",
					},
					{
						dimension: "evidence-strength",
						level: "high",
						score: 0.8,
						evidence: [],
						traceableTo: [],
						weight: 0.15,
						role: "primary",
					},
					{
						dimension: "generalizability-learning-value",
						level: "medium",
						score: 0.6,
						evidence: [],
						traceableTo: [],
						weight: 0.1,
						role: "primary",
					},
					{
						dimension: "engineering-architectural-relevance",
						level: "high",
						score: 0.75,
						evidence: [],
						traceableTo: [],
						weight: 0,
						role: "secondary",
					},
					{
						dimension: "availability-maturity",
						level: "medium",
						score: 0.6,
						evidence: [],
						traceableTo: [],
						weight: 0,
						role: "contextual",
					},
				],
				materialityScore: 0.82,
				materialityLevel: "high",
				decision: "SELECTED",
				decisionReasons: ["High materiality across dimensions."],
				decisionTraceableTo: [
					`claim_${"1".repeat(16)}`,
					`claim_${"2".repeat(16)}`,
				],
				uncertainty: [],
				sourceReferences: [
					"https://openai.com/research/o3",
					"https://github.blog/changelog/copilot-agent-background",
				],
				sourceIds: ["openai-research", "github-copilot-vscode"],
				claimIds: [
					`claim_${"1".repeat(16)}`,
					`claim_${"2".repeat(16)}`,
				],
			},
			historicalRelationship: null,
			historicalClassification: null,
		},
		{
			story: {
				storyId: `story_${"2".repeat(16)}`,
				order: 2,
				title: "Anthropic — AI Safety, Coding Agents",
				candidateId: `cand_${"2".repeat(16)}`,
				mergedCandidateIds: [],
				claimIds: [`claim_${"3".repeat(16)}`],
				sourceIds: ["anthropic-research", "claude-code-releases"],
				organizations: ["Anthropic"],
				researchDomains: ["ai-safety", "coding-agents"],
				discoveryRings: [1, 2],
				materialityScore: 0.72,
				materialityLevel: "high" as const,
				decision: "SELECTED" as const,
				summary: "Constitutional AI updates and Claude Code changelog.",
				recommendedDepth: "standard" as const,
				explanationOpportunities: [
					"strategic-interpretation",
					"accessible-comparison",
					"timeline",
				],
				evidenceClassificationSummary:
					"VENDOR_CLAIM (L0), EXPERT_INTERPRETATION (L1)",
				caveats: [
					"Safety claims not independently verified; methodology not fully disclosed",
				],
			},
			candidate: {
				candidateId: `cand_${"2".repeat(16)}`,
				editionId,
				editionDate,
				factualHeadline:
					"Anthropic updates Constitutional AI framework; Claude Code adds MCP task support",
				exactStatement:
					"Anthropic published updates to its Constitutional AI framework with new safety evaluations; Claude Code CLI adds MCP task support and checkpointing for autonomous development.",
				researchDomains: ["ai-safety", "coding-agents"],
				subdomainTags: ["DOM-03-SD02", "DOM-01-SD03"],
				discoveryRings: [1, 2],
				organizations: ["Anthropic"],
				products: ["Claude Code", "Constitutional AI"],
				technologies: ["constitutional AI", "MCP", "checkpointing"],
				researchProjects: [],
				sources: [
					{
						sourceId: "anthropic-research",
						canonicalUrl:
							"https://anthropic.com/research/constitutional-ai-updates",
						discoveryIds: [],
						retrievalStatus: "CHECKED_FOUND",
						accessedAt: now,
					},
					{
						sourceId: "claude-code-releases",
						canonicalUrl:
							"https://code.claude.com/docs/en/changelog",
						discoveryIds: [],
						retrievalStatus: "CHECKED_FOUND",
						accessedAt: now,
					},
				],
				timestamps: {
					originalPublicationTimestamp:
						"2025-01-14T14:00:00+01:00[Europe/Amsterdam]",
					earliestSupportedPublicDisclosureTimestamp:
						"2025-01-14T14:00:00+01:00[Europe/Amsterdam]",
					retrievalTimestamp: now,
					timezone: "Europe/Amsterdam",
					timestampConfidence: 0.9,
					timestampPrecision: "exact",
					timestampAvailability: "available",
				},
				temporalEligibility: {
					status: "NEW_PASS",
					rationale: "New developments within window.",
					noveltyClassification: {
						classification: "NEW",
						editionDate,
						inWindow: true,
						evidence: [],
						reasoning: "New.",
						primaryPublicationTimestamp:
							"2025-01-14T14:00:00+01:00[Europe/Amsterdam]",
						isSubstantiveUpdate: false,
						isNewlyRevealedFact: true,
						confidence: 0.85,
					},
					editionBoundary: {
						start,
						end,
						timezone: "Europe/Amsterdam",
					},
					derivedFrom: "novelty-classification",
					derivedAt: now,
				},
				previousCoverage: [],
				sourceAccessibility: [],
				claims: [
					{
						claimId: `claim_${"3".repeat(16)}`,
						candidateId: `cand_${"2".repeat(16)}`,
						claimStatement:
							"Anthropic Constitutional AI updates improve harmlessness without significant capability loss.",
						claimType: "scientific-research",
						evidenceClassification: "EXPERT_INTERPRETATION",
						supportingEvidenceUrls: [
							"https://anthropic.com/research/constitutional-ai-updates",
						],
						independentCorroboration: {
							established: false,
							sourceIds: [],
							urls: [],
							note: "Pending.",
						},
						contradictoryEvidence: [],
						limitingEvidence: [],
						technicalContext: {
							mechanism:
								"Refined constitution with new harmlessness criteria.",
							capabilities: ["improved harmlessness"],
							architecture: ["constitutional training"],
							limitations: ["Methodology not fully disclosed."],
							releaseMaturity: "research",
							implementationStatus: "research",
						},
						confidence: 0.7,
						verificationLevel: "L1",
						verificationStatus: "partially-verified",
						verificationRationale:
							"Expert interpretation, methodology partially reviewable.",
						verificationMethods: [
							"expert-consultation",
							"methodology-review",
						],
						uncertainty: {
							unresolved: [
								{
									type: "methodological",
									uncertainty: "Full methodology not public.",
									impact: "medium",
									blocking: false,
								},
							],
							assumptions: [],
							falsificationCriteria: [],
						},
						sourceProvenance: {
							sourceId: "anthropic-research",
							url: "https://anthropic.com/research/constitutional-ai-updates",
							title: "Anthropic Constitutional AI Updates",
							publicationTimestamp:
								"2025-01-14T14:00:00+01:00[Europe/Amsterdam]",
							retrievedAt: now,
							verificationTimestamp: now,
							verifiedBy: "test",
						},
						inclusionNote: "Demo fixture.",
					},
				],
				unresolvedQuestions: [],
				evidenceGaps: [],
				editorialReadiness: {
					materialNovelty: {
						level: "high",
						evidence: [],
						traceableTo: [],
					},
					technicalScientificSignificance: {
						level: "high",
						evidence: [],
						traceableTo: [],
					},
					realWorldConsequences: {
						level: "medium",
						evidence: [],
						traceableTo: [],
					},
					enterpriseEconomicImplications: {
						level: "low",
						evidence: [],
						traceableTo: [],
					},
					generalizability: {
						level: "medium",
						evidence: [],
						traceableTo: [],
					},
					evidenceStrength: {
						level: "medium",
						evidence: [],
						traceableTo: [],
					},
					evidenceLimitations: {
						level: "medium",
						evidence: [],
						traceableTo: [],
					},
					practicalEngineeringRelevance: {
						level: "high",
						evidence: [],
						traceableTo: [],
					},
					availabilityMaturity: {
						level: "low",
						evidence: [],
						traceableTo: [],
					},
					potentialOverlap: {
						level: "low",
						evidence: [],
						traceableTo: [],
					},
					selectionNote:
						"Descriptive indicators only — no editorial ranking, quotas, topic weights or publication decisions are made at this stage.",
				},
				processingStatus: "consolidated",
				audit: {
					discoveredAt: now,
					retrievedAt: now,
					noveltyClassifiedAt: now,
					claimsVerifiedAt: now,
					consolidatedAt: now,
					consolidatedBy: "demo",
					revision: 1,
				},
				provenance: {
					discoveryIds: [],
					candidateStableId: `cand_${"2".repeat(16)}`,
					pipeline: [],
					consumedFrom: [],
				},
			},
			assessment: {
				candidateId: `cand_${"2".repeat(16)}`,
				factualHeadline:
					"Anthropic updates Constitutional AI framework; Claude Code adds MCP task support",
				exactStatement:
					"Anthropic published updates to its Constitutional AI framework with new safety evaluations; Claude Code CLI adds MCP task support and checkpointing for autonomous development.",
				organizations: ["Anthropic"],
				products: ["Claude Code", "Constitutional AI"],
				technologies: ["constitutional AI", "MCP", "checkpointing"],
				researchDomains: ["ai-safety", "coding-agents"],
				discoveryRings: [1, 2],
				eligibility: {
					candidateId: `cand_${"2".repeat(16)}`,
					state: "ELIGIBLE",
					temporalStatus: "NEW_PASS",
					evidenceSufficiency: "ADEQUATE",
					hasBlockingUncertainty: false,
					noveltyStatementPresent: true,
					historicalRelationship: undefined,
					historicalConfidence: undefined,
					omissionReviewFlags: [],
					reasons: [
						"Safety framework update, CLI agent enhancement.",
					],
					traceableTo: [`claim_${"3".repeat(16)}`],
				},
				dimensions: [
					{
						dimension: "material-novelty",
						level: "high",
						score: 0.75,
						evidence: [],
						traceableTo: [],
						weight: 0.2,
						role: "primary",
					},
					{
						dimension: "scientific-technical-significance",
						level: "high",
						score: 0.7,
						evidence: [],
						traceableTo: [],
						weight: 0.2,
						role: "primary",
					},
					{
						dimension: "real-world-consequences",
						level: "medium",
						score: 0.55,
						evidence: [],
						traceableTo: [],
						weight: 0.15,
						role: "primary",
					},
					{
						dimension: "strategic-economic-significance",
						level: "low",
						score: 0.4,
						evidence: [],
						traceableTo: [],
						weight: 0.15,
						role: "primary",
					},
					{
						dimension: "evidence-strength",
						level: "medium",
						score: 0.6,
						evidence: [],
						traceableTo: [],
						weight: 0.15,
						role: "primary",
					},
					{
						dimension: "generalizability-learning-value",
						level: "medium",
						score: 0.55,
						evidence: [],
						traceableTo: [],
						weight: 0.1,
						role: "primary",
					},
					{
						dimension: "engineering-architectural-relevance",
						level: "high",
						score: 0.7,
						evidence: [],
						traceableTo: [],
						weight: 0,
						role: "secondary",
					},
					{
						dimension: "availability-maturity",
						level: "low",
						score: 0.3,
						evidence: [],
						traceableTo: [],
						weight: 0,
						role: "contextual",
					},
				],
				materialityScore: 0.68,
				materialityLevel: "high",
				decision: "SELECTED",
				decisionReasons: ["Safety relevance, engineering impact."],
				decisionTraceableTo: [`claim_${"3".repeat(16)}`],
				uncertainty: [],
				sourceReferences: [
					"https://anthropic.com/research/constitutional-ai-updates",
					"https://code.claude.com/docs/en/changelog",
				],
				sourceIds: ["anthropic-research", "claude-code-releases"],
				claimIds: [`claim_${"3".repeat(16)}`],
			},
			historicalRelationship: null,
			historicalClassification: null,
		},
		{
			story: {
				storyId: `story_${"3".repeat(16)}`,
				order: 3,
				title: "McKinsey Global Institute, GitHub — Enterprise Adoption, Developer Productivity",
				candidateId: `cand_${"3".repeat(16)}`,
				mergedCandidateIds: [],
				claimIds: [
					`claim_${"4".repeat(16)}`,
					`claim_${"5".repeat(16)}`,
				],
				sourceIds: ["mckinsey-insights", "github-research"],
				organizations: ["McKinsey Global Institute", "GitHub"],
				researchDomains: [
					"enterprise-adoption",
					"developer-productivity",
				],
				discoveryRings: [2, 3],
				materialityScore: 0.68,
				materialityLevel: "medium" as const,
				decision: "SELECTED" as const,
				summary:
					"Enterprise AI adoption survey and Copilot productivity study.",
				recommendedDepth: "standard" as const,
				explanationOpportunities: [
					"strategic-interpretation",
					"historical-context",
					"accessible-comparison",
				],
				evidenceClassificationSummary:
					"RESEARCH_FINDING (L1), ORIGINAL_REPORTING (L1)",
				caveats: [
					"Survey methodology limitations; self-reported productivity metrics",
				],
			},
			candidate: {
				candidateId: `cand_${"3".repeat(16)}`,
				editionId,
				editionDate,
				factualHeadline:
					"McKinsey study finds material variation in enterprise AI productivity; GitHub Copilot study reports 55% faster tasks",
				exactStatement:
					"McKinsey Global Institute survey of 1,200 enterprises finds wide variation in AI productivity outcomes; GitHub controlled study with 95 developers reports 55% faster task completion with Copilot.",
				researchDomains: [
					"enterprise-adoption",
					"developer-productivity",
				],
				subdomainTags: ["DOM-04-SD01", "DOM-04-SD02"],
				discoveryRings: [2, 3],
				organizations: ["McKinsey Global Institute", "GitHub"],
				products: ["GitHub Copilot"],
				technologies: ["enterprise AI adoption", "coding assistants"],
				researchProjects: [],
				sources: [
					{
						sourceId: "mckinsey-insights",
						canonicalUrl:
							"https://mckinsey.com/insights/ai-productivity-2025",
						discoveryIds: [],
						retrievalStatus: "CHECKED_FOUND",
						accessedAt: now,
					},
					{
						sourceId: "github-research",
						canonicalUrl:
							"https://github.blog/engineering/copilot-productivity-study",
						discoveryIds: [],
						retrievalStatus: "CHECKED_FOUND",
						accessedAt: now,
					},
				],
				timestamps: {
					originalPublicationTimestamp:
						"2025-01-14T16:00:00+01:00[Europe/Amsterdam]",
					earliestSupportedPublicDisclosureTimestamp:
						"2025-01-14T16:00:00+01:00[Europe/Amsterdam]",
					retrievalTimestamp: now,
					timezone: "Europe/Amsterdam",
					timestampConfidence: 0.85,
					timestampPrecision: "exact",
					timestampAvailability: "available",
				},
				temporalEligibility: {
					status: "NEW_PASS",
					rationale: "New developments within window.",
					noveltyClassification: {
						classification: "NEW",
						editionDate,
						inWindow: true,
						evidence: [],
						reasoning: "New.",
						primaryPublicationTimestamp:
							"2025-01-14T16:00:00+01:00[Europe/Amsterdam]",
						isSubstantiveUpdate: false,
						isNewlyRevealedFact: true,
						confidence: 0.8,
					},
					editionBoundary: {
						start,
						end,
						timezone: "Europe/Amsterdam",
					},
					derivedFrom: "novelty-classification",
					derivedAt: now,
				},
				previousCoverage: [],
				sourceAccessibility: [],
				claims: [
					{
						claimId: `claim_${"4".repeat(16)}`,
						candidateId: `cand_${"3".repeat(16)}`,
						claimStatement:
							"Enterprise AI productivity outcomes vary materially across industry cohorts.",
						claimType: "strategic-research",
						evidenceClassification: "RESEARCH_FINDING",
						supportingEvidenceUrls: [
							"https://mckinsey.com/insights/ai-productivity-2025",
						],
						independentCorroboration: {
							established: false,
							sourceIds: [],
							urls: [],
							note: "Pending.",
						},
						contradictoryEvidence: [],
						limitingEvidence: [],
						strategicContext: {
							researchPurpose:
								"Measure enterprise AI adoption and productivity outcomes.",
							sampleSize: 1200,
							sampleComposition:
								"Enterprise technology leaders across 14 industries.",
							geographicScope: "Global",
							industryCoverage: "14 industries",
							researchPeriod: "2024-09 to 2024-12",
							measuredOutcome:
								"Reported productivity change relative to pre-adoption baseline.",
							baseline: "Pre-adoption productivity.",
							statisticalUncertainty:
								"Margin of error ±4pp at 95% confidence.",
							causalClaimType: "correlation",
							generalizability: "Surveyed enterprise population.",
						},
						confidence: 0.75,
						verificationLevel: "L1",
						verificationStatus: "verified",
						verificationRationale:
							"Methodology reviewed, survey design documented.",
						verificationMethods: ["methodology-review"],
						uncertainty: {
							unresolved: [
								{
									type: "methodological",
									uncertainty:
										"Self-reported metrics, no objective measurement.",
									impact: "high",
									blocking: false,
								},
							],
							assumptions: [],
							falsificationCriteria: [],
						},
						sourceProvenance: {
							sourceId: "mckinsey-insights",
							url: "https://mckinsey.com/insights/ai-productivity-2025",
							title: "McKinsey AI Productivity 2025",
							publicationTimestamp:
								"2025-01-14T16:00:00+01:00[Europe/Amsterdam]",
							retrievedAt: now,
							verificationTimestamp: now,
							verifiedBy: "test",
						},
						inclusionNote: "Demo fixture.",
					},
					{
						claimId: `claim_${"5".repeat(16)}`,
						candidateId: `cand_${"3".repeat(16)}`,
						claimStatement:
							"Developers using Copilot complete standardized tasks 55% faster.",
						claimType: "productivity-claim",
						evidenceClassification: "ORIGINAL_REPORTING",
						supportingEvidenceUrls: [
							"https://github.blog/engineering/copilot-productivity-study",
						],
						independentCorroboration: {
							established: false,
							sourceIds: [],
							urls: [],
							note: "Pending.",
						},
						contradictoryEvidence: [],
						limitingEvidence: [],
						strategicContext: {
							researchPurpose:
								"Measure coding assistant productivity impact.",
							sampleSize: 95,
							sampleComposition:
								"Developers implementing HTTP server in JavaScript.",
							geographicScope: "Controlled environment",
							industryCoverage: "N/A",
							researchPeriod: "2024",
							measuredOutcome: "Task completion time.",
							baseline: "Control group without Copilot.",
							statisticalUncertainty: "Not disclosed.",
							causalClaimType: "causation",
							generalizability:
								"Single task, controlled setting.",
						},
						confidence: 0.7,
						verificationLevel: "L1",
						verificationStatus: "verified",
						verificationRationale:
							"Controlled experiment, vendor-conducted.",
						verificationMethods: ["methodology-review"],
						uncertainty: {
							unresolved: [
								{
									type: "methodological",
									uncertainty:
										"Vendor-conducted, short-term, single task.",
									impact: "high",
									blocking: false,
								},
							],
							assumptions: [],
							falsificationCriteria: [],
						},
						sourceProvenance: {
							sourceId: "github-research",
							url: "https://github.blog/engineering/copilot-productivity-study",
							title: "GitHub Copilot Productivity Study",
							publicationTimestamp:
								"2025-01-14T16:00:00+01:00[Europe/Amsterdam]",
							retrievedAt: now,
							verificationTimestamp: now,
							verifiedBy: "test",
						},
						inclusionNote: "Demo fixture.",
					},
				],
				unresolvedQuestions: [],
				evidenceGaps: [],
				editorialReadiness: {
					materialNovelty: {
						level: "medium",
						evidence: [],
						traceableTo: [],
					},
					technicalScientificSignificance: {
						level: "medium",
						evidence: [],
						traceableTo: [],
					},
					realWorldConsequences: {
						level: "high",
						evidence: [],
						traceableTo: [],
					},
					enterpriseEconomicImplications: {
						level: "high",
						evidence: [],
						traceableTo: [],
					},
					generalizability: {
						level: "low",
						evidence: [],
						traceableTo: [],
					},
					evidenceStrength: {
						level: "medium",
						evidence: [],
						traceableTo: [],
					},
					evidenceLimitations: {
						level: "high",
						evidence: [],
						traceableTo: [],
					},
					practicalEngineeringRelevance: {
						level: "high",
						evidence: [],
						traceableTo: [],
					},
					availabilityMaturity: {
						level: "high",
						evidence: [],
						traceableTo: [],
					},
					potentialOverlap: {
						level: "low",
						evidence: [],
						traceableTo: [],
					},
					selectionNote:
						"Descriptive indicators only — no editorial ranking, quotas, topic weights or publication decisions are made at this stage.",
				},
				processingStatus: "consolidated",
				audit: {
					discoveredAt: now,
					retrievedAt: now,
					noveltyClassifiedAt: now,
					claimsVerifiedAt: now,
					consolidatedAt: now,
					consolidatedBy: "demo",
					revision: 1,
				},
				provenance: {
					discoveryIds: [],
					candidateStableId: `cand_${"3".repeat(16)}`,
					pipeline: [],
					consumedFrom: [],
				},
			},
			assessment: {
				candidateId: `cand_${"3".repeat(16)}`,
				factualHeadline:
					"McKinsey study finds material variation in enterprise AI productivity; GitHub Copilot study reports 55% faster tasks",
				exactStatement:
					"McKinsey Global Institute survey of 1,200 enterprises finds wide variation in AI productivity outcomes; GitHub controlled study with 95 developers reports 55% faster task completion with Copilot.",
				organizations: ["McKinsey Global Institute", "GitHub"],
				products: ["GitHub Copilot"],
				technologies: ["enterprise AI adoption", "coding assistants"],
				researchDomains: [
					"enterprise-adoption",
					"developer-productivity",
				],
				discoveryRings: [2, 3],
				eligibility: {
					candidateId: `cand_${"3".repeat(16)}`,
					state: "ELIGIBLE",
					temporalStatus: "NEW_PASS",
					evidenceSufficiency: "ADEQUATE",
					hasBlockingUncertainty: false,
					noveltyStatementPresent: true,
					historicalRelationship: undefined,
					historicalConfidence: undefined,
					omissionReviewFlags: [],
					reasons: ["Enterprise survey, productivity study."],
					traceableTo: [
						`claim_${"4".repeat(16)}`,
						`claim_${"5".repeat(16)}`,
					],
				},
				dimensions: [
					{
						dimension: "material-novelty",
						level: "medium",
						score: 0.65,
						evidence: [],
						traceableTo: [],
						weight: 0.2,
						role: "primary",
					},
					{
						dimension: "scientific-technical-significance",
						level: "medium",
						score: 0.55,
						evidence: [],
						traceableTo: [],
						weight: 0.2,
						role: "primary",
					},
					{
						dimension: "real-world-consequences",
						level: "high",
						score: 0.75,
						evidence: [],
						traceableTo: [],
						weight: 0.15,
						role: "primary",
					},
					{
						dimension: "strategic-economic-significance",
						level: "high",
						score: 0.7,
						evidence: [],
						traceableTo: [],
						weight: 0.15,
						role: "primary",
					},
					{
						dimension: "evidence-strength",
						level: "medium",
						score: 0.6,
						evidence: [],
						traceableTo: [],
						weight: 0.15,
						role: "primary",
					},
					{
						dimension: "generalizability-learning-value",
						level: "low",
						score: 0.4,
						evidence: [],
						traceableTo: [],
						weight: 0.1,
						role: "primary",
					},
					{
						dimension: "engineering-architectural-relevance",
						level: "high",
						score: 0.65,
						evidence: [],
						traceableTo: [],
						weight: 0,
						role: "secondary",
					},
					{
						dimension: "availability-maturity",
						level: "high",
						score: 0.75,
						evidence: [],
						traceableTo: [],
						weight: 0,
						role: "contextual",
					},
				],
				materialityScore: 0.65,
				materialityLevel: "medium",
				decision: "SELECTED",
				decisionReasons: [
					"Enterprise relevance, productivity evidence.",
				],
				decisionTraceableTo: [
					`claim_${"4".repeat(16)}`,
					`claim_${"5".repeat(16)}`,
				],
				uncertainty: [],
				sourceReferences: [
					"https://mckinsey.com/insights/ai-productivity-2025",
					"https://github.blog/engineering/copilot-productivity-study",
				],
				sourceIds: ["mckinsey-insights", "github-research"],
				claimIds: [
					`claim_${"4".repeat(16)}`,
					`claim_${"5".repeat(16)}`,
				],
			},
			historicalRelationship: null,
			historicalClassification: null,
		},
	];

	const listeningNarrativeInput: ListeningNarrativeGenerationInput = {
		editionDate,
		editionWindow: editionIdentity.editionWindow,
		factDossier: {
			schemaVersion: "1.0.0",
			dossierId: canonicalReferences.factDossier.dossierId,
			editionId,
			editionDate,
			editionWindow: editionIdentity.editionWindow,
			status: "complete",
			createdAt: now,
			updatedAt: now,
			generatedBy: "demo",
			candidates: stories.map((s) => s.candidate),
			editionSummary: {
				totalCandidates: 3,
				byTemporalEligibility: { NEW_PASS: 3 },
				byEvidenceClassification: {
					VERIFIED_FACT: 1,
					RESEARCH_FINDING: 1,
					VENDOR_CLAIM: 1,
					EXPERT_INTERPRETATION: 1,
					ORIGINAL_REPORTING: 1,
				},
				byVerificationStatus: {
					verified: 3,
					partially_verified: 1,
					unverified: 1,
				},
				byResearchDomain: {
					"foundation-models": 1,
					"coding-agents": 2,
					"ai-safety": 1,
					"enterprise-adoption": 1,
					"developer-productivity": 1,
				},
				totalClaims: 5,
				claimsWithCounterevidence: 0,
				claimsWithUnresolvedUncertainties: 0,
				candidatesWithEvidenceGaps: 0,
				averageClaimConfidence: 0.76,
				strategicResearchCandidates: 1,
				technicalCandidates: 2,
			},
			uncertaintyRegister: [],
			historicalContinuity: [],
			processingAudit: {
				startedAt: now,
				completedAt: now,
				durationMs: 0,
				steps: [],
				completedCandidateIds: [],
				failedCandidateIds: [],
				skippedCandidateIds: [],
				inferenceUsed: false,
			},
			contentHash: canonicalReferences.factDossier.contentHash,
		} as any,
		editorialManifest: {
			schemaVersion: "1.0.0",
			manifestId: canonicalReferences.editorialSelection.manifestId,
			editionId,
			editionDate,
			editionWindow: editionIdentity.editionWindow,
			generatedAt: now,
			generatedBy: "demo",
			inputDossier: {
				dossierId: canonicalReferences.factDossier.dossierId,
				contentHash: canonicalReferences.factDossier.contentHash,
				editionDate,
				candidateCount: 3,
			},
			omissionReview: canonicalReferences.omissionReview,
			historicalRegression: canonicalReferences.historicalRegression,
			candidates: stories.map((s) => s.assessment),
			stories: stories.map((s) => s.story),
			relationships: [],
			concentrationReview: {
				reviewedAt: now,
				selectedStoryCount: 3,
				organizationDistribution: {},
				ringDistribution: {},
				claimTypeDistribution: {},
				findings: [],
				consistencyChecks: [],
				strongestExcluded: undefined,
				weakestSelected: undefined,
				rankingInconsistenciesFound: 0,
				correctionsApplied: [],
				residualRisks: [],
				modelAssisted: false,
				note: "Demo",
			},
			caveats: [],
			unresolvedIssues: [],
			readinessStatus: "READY",
			inferenceUsed: false,
			weightingAssumptions: [],
			contentHash: canonicalReferences.editorialSelection.contentHash,
		} as any,
		historicalRegression: null,
		stories:
			stories as unknown as ListeningNarrativeGenerationInput["stories"],
	};

	// Generate the listening narrative for demo
	const listeningNarrativeResult = await generateListeningNarrativeMarkdown(
		listeningNarrativeInput,
		{ validateOnly: true },
	);

	return {
		editionIdentity,
		canonicalReferences,
		listeningNarrativeInput,
		listeningNarrativeResult,
	};
}

async function main() {
	const options = parseCliArgs();
	const { edition, demo, validateOnly, persist, skipQ1Q10 } = options;
	const editionDate = edition;

	console.log(
		`Running Audio A-G evaluation for edition: ${editionDate}${demo ? " (DEMO MODE)" : ""}${validateOnly ? " (VALIDATE ONLY)" : ""}`,
	);

	let editionIdentity: EditionIdentity;
	let canonicalReferences: CanonicalReferences;
	let listeningNarrativeInput: ListeningNarrativeGenerationInput;
	let listeningNarrativeResult: ListeningNarrativeGenerationResult;
	let publicationMetadata: any;
	let qEvaluationReport: ListeningQualityEvaluationReport | null = null;

	if (demo) {
		const data = await loadDemoData(edition);
		editionIdentity = data.editionIdentity;
		canonicalReferences = data.canonicalReferences;
		listeningNarrativeInput = data.listeningNarrativeInput;
		listeningNarrativeResult = data.listeningNarrativeResult;

		publicationMetadata = {
			artifactId: `pubart_${"1".repeat(16)}`,
			editionId: editionIdentity.editionId,
			editionDate: editionIdentity.editionDate,
			contentType: "listening-narrative",
			language: "nl",
			canonicalFilename: `AI Daily Intelligence — ${edition}.md`,
			title: `AI Daily Intelligence — ${edition}`,
			description:
				"Volledig, onafhankelijk geauthored Nederlands luisternarratief.",
			publicationTimestamp: new Date().toISOString(),
			estimatedListeningDurationMinutes:
				listeningNarrativeResult.metadata
					.estimatedListeningDurationMinutes,
			lifecycleStatus: "DRAFT",
		};
	} else {
		// Load real data
		try {
			listeningNarrativeInput =
				await loadListeningNarrativeGenerationInput(edition);

			editionIdentity = {
				editionId: listeningNarrativeInput.factDossier.editionId,
				editionDate: listeningNarrativeInput.factDossier.editionDate,
				editionWindow:
					listeningNarrativeInput.factDossier.editionWindow,
				reportingWindow: {
					start: listeningNarrativeInput.editionWindow.start,
					end: listeningNarrativeInput.editionWindow.end,
					timezone: "Europe/Amsterdam" as const,
				},
			};

			canonicalReferences = {
				factDossier: {
					dossierId: listeningNarrativeInput.factDossier.dossierId,
					editionId: listeningNarrativeInput.factDossier.editionId,
					contentHash:
						listeningNarrativeInput.factDossier.contentHash,
				},
				editorialSelection: {
					manifestId:
						listeningNarrativeInput.editorialManifest.manifestId,
					editionId:
						listeningNarrativeInput.editorialManifest.editionId,
					contentHash:
						listeningNarrativeInput.editorialManifest.contentHash,
				},
				historicalRegression: {
					reportId:
						listeningNarrativeInput.historicalRegression
							?.reportId ?? "",
					editionId:
						listeningNarrativeInput.historicalRegression
							?.editionId ?? "",
					contentHash:
						listeningNarrativeInput.historicalRegression
							?.contentHash ?? "",
					referenced: !!listeningNarrativeInput.historicalRegression,
				},
				omissionReview: {
					reportId:
						listeningNarrativeInput.editorialManifest.omissionReview
							.reportId ??
						`omission-${listeningNarrativeInput.editorialManifest.manifestId}`,
					executionId:
						listeningNarrativeInput.editorialManifest.omissionReview
							.executionId ??
						`exec-${listeningNarrativeInput.editorialManifest.manifestId}`,
					referenced:
						listeningNarrativeInput.editorialManifest.omissionReview
							.referenced,
				},
			};

			// Load or generate the listening narrative
			if (validateOnly) {
				const narrativePath = join(
					PROJECT_ROOT,
					getListeningNarrativePath(edition),
				);
				try {
					const { readFile } = await import("fs/promises");
					listeningNarrativeResult = {
						markdown: await readFile(narrativePath, "utf-8"),
						metadata: {
							contentHash: "",
							artifactId: "",
							estimatedListeningDurationMinutes: 0,
							wordCount: 0,
							segmentCount: 0,
							storiesCovered: 0,
						},
						traceability: {
							segments: [],
							claimCoverage: [],
							sourceCoverage: [],
							storyCoverage: [],
						},
						checkpoint: null,
						validation: { valid: true, errors: [], warnings: [] },
					};
				} catch {
					console.error(
						"No existing listening narrative found. Generate it first with build-publication.ts",
					);
					process.exit(1);
				}
			} else {
				listeningNarrativeResult =
					await generateListeningNarrativeMarkdown(
						listeningNarrativeInput,
					);
			}

			// Load publication metadata
			const metadataPath =
				join(PROJECT_ROOT, getListeningNarrativePath(edition)) +
				".meta.json";
			try {
				const { readFile } = await import("fs/promises");
				const content = await readFile(metadataPath, "utf-8");
				publicationMetadata = JSON.parse(content);
			} catch {
				publicationMetadata = {
					artifactId: `pubart_${"1".repeat(16)}`,
					editionId: editionIdentity.editionId,
					editionDate: edition,
					contentType: "listening-narrative",
					language: "nl",
					canonicalFilename: `AI Daily Intelligence — ${edition}.md`,
					title: `AI Daily Intelligence — ${edition}`,
					description:
						"Volledig, onafhankelijk geauthored Nederlands luisternarratief.",
					publicationTimestamp: new Date().toISOString(),
					estimatedListeningDurationMinutes:
						listeningNarrativeResult.metadata
							.estimatedListeningDurationMinutes,
					lifecycleStatus: "DRAFT",
				};
			}
		} catch (error) {
			console.error("Failed to load real data:", error);
			console.error("Use --demo for testing with synthetic data.");
			process.exit(1);
		}
	}

	// Validate inputs
	editionIdentity = EditionIdentitySchema.parse(editionIdentity);
	canonicalReferences = CanonicalReferencesSchema.parse(canonicalReferences);

	// Step 1: Run Q1-Q10 evaluation (unless skipped)
	if (!skipQ1Q10) {
		console.log("\n--- Step 1: Running Q1-Q10 evaluation ---");
		const qEvaluationInput = {
			editionDate,
			editionId: editionIdentity.editionId,
			listeningNarrativeMarkdown: listeningNarrativeResult.markdown,
			listeningNarrativeArtifactId: publicationMetadata.artifactId,
			listeningNarrativeTraceability:
				listeningNarrativeResult.traceability,
			factDossier: listeningNarrativeInput.factDossier,
			editorialManifest: listeningNarrativeInput.editorialManifest,
			historicalRegression: listeningNarrativeInput.historicalRegression,
			publicationMetadata,
			articleIdentities: [],
			validationMode: validateOnly,
		};

		qEvaluationReport = await evaluateListeningQuality(qEvaluationInput);

		console.log("\n=== Q1-Q10 Evaluation Summary ===");
		for (const evalResult of qEvaluationReport.criterionEvaluations) {
			const statusIcon =
				evalResult.status === "PASS"
					? "✅"
					: evalResult.status === "FAIL"
						? "❌"
						: evalResult.status === "UNVERIFIED"
							? "⚠️"
							: "➖";
			const severityStr = evalResult.severity
				? ` [${evalResult.severity}]`
				: "";
			console.log(
				`${statusIcon} ${evalResult.criterionId}: ${evalResult.status}${severityStr} - ${evalResult.summary}`,
			);
		}
		console.log("\n=== Q1-Q10 Overall Summary ===");
		console.log(`Passed: ${qEvaluationReport.overallSummary.passedCount}`);
		console.log(`Failed: ${qEvaluationReport.overallSummary.failedCount}`);
		console.log(
			`Unverified: ${qEvaluationReport.overallSummary.unverifiedCount}`,
		);
		console.log(
			`Critical Failures: ${qEvaluationReport.overallSummary.criticalFailures}`,
		);
		console.log(
			`Major Failures: ${qEvaluationReport.overallSummary.majorFailures}`,
		);
		console.log(
			`Blocking Acceptance: ${qEvaluationReport.overallSummary.blockingAcceptance ? "YES" : "NO"}`,
		);
	} else {
		console.log("\n--- Skipping Q1-Q10 evaluation (--skip-q1q10) ---");
	}

	// Step 2: Run Audio A-G evaluation
	console.log("\n--- Step 2: Running Audio A-G evaluation ---");
	const audioEvaluationInput = {
		editionDate,
		editionId: editionIdentity.editionId,
		listeningNarrativeMarkdown: listeningNarrativeResult.markdown,
		listeningNarrativeArtifactId: publicationMetadata.artifactId,
		listeningNarrativeTraceability: listeningNarrativeResult.traceability,
		factDossier: listeningNarrativeInput.factDossier,
		editorialManifest: listeningNarrativeInput.editorialManifest,
		historicalRegression: listeningNarrativeInput.historicalRegression,
		publicationMetadata,
		articleIdentities: [],
		validationMode: validateOnly,
		qEvaluationReport: qEvaluationReport ?? undefined,
	};

	const { evaluationReport: audioReport, holisticAssessment } =
		await evaluateAudioQuality(audioEvaluationInput);

	// Print Audio A-G summary
	console.log("\n=== Audio A-G Evaluation Summary ===");
	for (const evalResult of audioReport.criterionEvaluations.filter((e) =>
		["A", "B", "C", "D", "E", "F", "G"].includes(e.criterionId),
	)) {
		const statusIcon =
			evalResult.status === "PASS"
				? "✅"
				: evalResult.status === "FAIL"
					? "❌"
					: evalResult.status === "UNVERIFIED"
						? "⚠️"
						: "➖";
		const severityStr = evalResult.severity
			? ` [${evalResult.severity}]`
			: "";
		const qRefStr =
			evalResult.qEvidenceReferences &&
			evalResult.qEvidenceReferences.length > 0
				? ` (Q-refs: ${evalResult.qEvidenceReferences.length})`
				: "";
		console.log(
			`${statusIcon} ${evalResult.criterionId}: ${evalResult.status}${severityStr}${qRefStr} - ${evalResult.summary}`,
		);
		if (evalResult.repairAttempted && evalResult.repairActionId) {
			const repair = audioReport.repairActions.find(
				(r) => r.repairActionId === evalResult.repairActionId,
			);
			console.log(
				`    🔧 Repair: ${repair?.status} - ${repair?.residualUncertainty}`,
			);
		}
		if (evalResult.reassessment) {
			console.log(
				`    🔄 Reassessment: ${evalResult.reassessment.status} - ${evalResult.reassessment.summary}`,
			);
		}
	}

	// Print holistic assessment
	console.log("\n=== Holistic Listening Experience Assessment ===");
	console.log(`Overall Status: ${holisticAssessment.overallStatus}`);
	console.log(`Overall Summary: ${holisticAssessment.overallSummary}`);
	if (holisticAssessment.tradeoffs.length > 0) {
		console.log("\nIdentified Trade-offs:");
		for (const t of holisticAssessment.tradeoffs) {
			console.log(
				`  - ${t.criteria.join("+")}: ${t.description} [${t.severity}] → ${t.recommendation}`,
			);
		}
	}
	if (holisticAssessment.residualUncertainty) {
		console.log(
			`\nResidual Uncertainty: ${holisticAssessment.residualUncertainty}`,
		);
	}

	// Print combined summary
	console.log("\n=== Combined Q1-Q10 + Audio A-G Summary ===");
	console.log(
		`Total Criteria: ${audioReport.criterionEvaluations.length} (${audioReport.criterionEvaluations.filter((e) => ["Q1", "Q2", "Q3", "Q4", "Q5", "Q6", "Q7", "Q8", "Q9", "Q10"].includes(e.criterionId)).length} Q1-Q10 + ${audioReport.criterionEvaluations.filter((e) => ["A", "B", "C", "D", "E", "F", "G"].includes(e.criterionId)).length} Audio A-G)`,
	);
	console.log(`Passed: ${audioReport.overallSummary.passedCount}`);
	console.log(`Failed: ${audioReport.overallSummary.failedCount}`);
	console.log(`Unverified: ${audioReport.overallSummary.unverifiedCount}`);
	console.log(
		`Not Assessable: ${audioReport.overallSummary.notAssessableCount}`,
	);
	console.log(
		`Critical Failures: ${audioReport.overallSummary.criticalFailures}`,
	);
	console.log(`Major Failures: ${audioReport.overallSummary.majorFailures}`);
	console.log(
		`Blocking Acceptance: ${audioReport.overallSummary.blockingAcceptance ? "YES" : "NO"}`,
	);
	console.log(
		`Repair Actions: ${audioReport.overallSummary.repairActionsTaken} (${audioReport.overallSummary.repairActionsSuccessful} successful)`,
	);

	console.log("\n=== Evaluation Metadata ===");
	console.log(
		`Model-assisted: ${audioReport.metadata.modelAssistedEvaluations}`,
	);
	console.log(
		`Deterministic: ${audioReport.metadata.deterministicEvaluations}`,
	);
	console.log(
		`Inference requests: ${audioReport.metadata.totalInferenceRequests}`,
	);
	console.log(
		`Inference tokens: ${audioReport.metadata.totalInferenceTokens}`,
	);
	console.log(
		`Providers: ${audioReport.metadata.inferenceProvidersUsed.join(", ")}`,
	);
	console.log(
		`Validation mode: ${audioReport.metadata.validationMode ? "YES" : "NO"}`,
	);

	if (validateOnly) {
		console.log(
			"\nValidation-only mode: not persisting evaluation report.",
		);
		return;
	}

	// Persist evaluation report
	if (persist) {
		console.log("\nPersisting Audio A-G evaluation report...");
		const filepath = await persistAudioEvaluationReport(
			edition,
			audioReport,
		);
		console.log(`  ✓ ${filepath}`);
	}

	console.log("\nAudio A-G evaluation completed successfully.");
}

main().catch((err) => {
	console.error("Evaluation failed:", err);
	process.exit(1);
});
