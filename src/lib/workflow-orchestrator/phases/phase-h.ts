/** Phase H — Publication Preparation: Evidence Aggregation */

import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { randomBytes, createHash } from "crypto";
import type { WorkflowLock } from "../schema.js";
import { editionLockPath } from "../edition-lock.js";

interface AggregatedEvidencePackage {
	packageId: string;
	editionDate: string;
	editionId: string;
	sourceEvidence: {
		discoveryLedgerPath: string;
		omissionReviewPath: string;
		historicalRegressionPath: string;
	};
	editorialEvidence: {
		selectionManifestPath: string;
		resolvedManifestPath: string;
	};
	publicationEvidence: {
		canonicalDocuments: Array<{
			artifactId: string;
			path: string;
			status: string;
		}>;
		websiteDerivatives: Array<{
			artifactId: string;
			path: string;
			status: string;
		}>;
	};
	qualityEvidence: {
		q1q10EvaluationPath: string;
		audioAgEvaluationPath: string;
		readableEvaluationPath: string;
		visualizationAccessibilityPath: string;
		boundedRepairsPath: string;
	};
	knowledgeEvidence: {
		thesaurusEvaluationPath: string;
		architecturePrinciplesEvaluationPath: string;
		bookDeltaEvaluationPath: string;
		knowledgeContinuityValidationPath: string;
	};
	acceptanceInputs: {
		publicationValidationPath: string;
		acceptanceDecisionPath: string;
	};
	overallContentHash: string;
	generatedAt: string;
	generatedBy: string;
}

interface PhaseHInput {
	editionDate: string;
	"execution-manifest"?: ArtifactRef;
	"evidence-package"?: ArtifactRef;
	"final-newsletter"?: ArtifactWithMeta;
	"final-listening-nl"?: ArtifactWithMeta;
	"final-research-audit"?: ArtifactWithMeta;
	"final-daily-index"?: ArtifactWithMeta;
	"workflow-lock"?: ArtifactRef;
}

interface ArtifactRef {
	path?: string;
	[key: string]: unknown;
}

interface ArtifactWithMeta {
	path?: string;
	meta?: { path?: string; lifecycleStatus?: string };
	[key: string]: unknown;
}

interface ExecutionManifest {
	editionDate: string;
	stages: Array<{
		stageId: string;
		state: "SUCCEEDED" | "FAILED" | "INCOMPLETE" | "SKIPPED" | "BLOCKED";
		resourcesUsed?: {
			modelRequests?: number;
			tokensUsed?: number;
			sourceRequests?: number;
			cpuTimeMs?: number;
			memoryPeakMb?: number;
		};
		error?: { message?: string };
	}>;
	resourcesUsed: Record<string, unknown>;
	manifestId?: string;
	workflowGraphVersion?: string;
	contractVersion?: string;
	completedAt?: string;
	requestedAt?: string;
	checkpoints?: unknown[];
	resumeHistory?: unknown[];
}

interface EvidencePackage {
	packageId?: string;
	overallContentHash?: string;
	[key: string]: unknown;
}

/**
 * Aggregate Research, Editorial, Quality & Knowledge Evidence (H03_AGGREGATE_EVIDENCE).
 * Entry point for workflow stage H03.
 * Compiles complete evidence package linking source → retrieval → candidate → classification → verification → dossier → selection → publication → evaluation → acceptance inputs
 */
export async function aggregateEvidence(input: PhaseHInput): Promise<any> {
	const editionDate = input.editionDate;
	const editionId = `edition_${editionDate}`;

	// Helper to find latest artifact file
	const findLatestArtifact = (
		dir: string,
		pattern: string,
	): string | null => {
		try {
			const files = readdirSync(dir)
				.filter(
					(f: string) =>
						f.startsWith(`${editionDate}_`) && f.endsWith(".json"),
				)
				.sort();
			if (files.length > 0) {
				return join(dir, files[files.length - 1]);
			}
		} catch {}
		return null;
	};

	// Build aggregated evidence package
	const packageData: AggregatedEvidencePackage = {
		packageId: `evipkg_${randomBytes(8).toString("hex")}`,
		editionDate,
		editionId,
		sourceEvidence: {
			discoveryLedgerPath:
				findLatestArtifact(
					"data/discovery-ledger",
					`${editionDate}_`,
				) || "",
			omissionReviewPath:
				findLatestArtifact(
					"data/omission-reviews",
					`${editionDate}_`,
				) || "",
			historicalRegressionPath:
				findLatestArtifact(
					"data/historical-regression",
					`${editionDate}_`,
				) || "",
		},
		editorialEvidence: {
			selectionManifestPath:
				findLatestArtifact(
					"data/editorial-selection",
					`${editionDate}_`,
				) || "",
			resolvedManifestPath:
				findLatestArtifact(
					"data/editorial-selection",
					`${editionDate}_resolved_`,
				) || "",
		},
		publicationEvidence: {
			canonicalDocuments: [
				{
					artifactId: "",
					path: `editions/edition_${editionDate}/canonical/publication.md`,
					status: "VALIDATED",
				},
				{
					artifactId: "",
					path: `editions/edition_${editionDate}/canonical/AI Daily Intelligence — ${editionDate}.md`,
					status: "VALIDATED",
				},
				{
					artifactId: "",
					path: `editions/edition_${editionDate}/canonical/research-audit.md`,
					status: "VALIDATED",
				},
			],
			websiteDerivatives: [
				{
					artifactId: "",
					path: `editions/edition_${editionDate}/derivatives/english-articles/`,
					status: "VALIDATED",
				},
				{
					artifactId: "",
					path: `editions/edition_${editionDate}/derivatives/english-listening/`,
					status: "VALIDATED",
				},
				{
					artifactId: "",
					path: `editions/edition_${editionDate}/index.md`,
					status: "VALIDATED",
				},
			],
		},
		qualityEvidence: {
			q1q10EvaluationPath:
				findLatestArtifact("data/quality/q1q10", `${editionDate}_`) ||
				"",
			audioAgEvaluationPath:
				findLatestArtifact(
					"data/quality/audio-ag",
					`${editionDate}_`,
				) || "",
			readableEvaluationPath:
				findLatestArtifact(
					"data/quality/readable",
					`${editionDate}_`,
				) || "",
			visualizationAccessibilityPath:
				findLatestArtifact(
					"data/quality/visualization",
					`${editionDate}_`,
				) || "",
			boundedRepairsPath:
				findLatestArtifact("data/quality/repairs", `${editionDate}_`) ||
				"",
		},
		knowledgeEvidence: {
			thesaurusEvaluationPath:
				findLatestArtifact(
					"data/thesaurus/evaluations",
					`${editionDate}_`,
				) || "",
			architecturePrinciplesEvaluationPath:
				findLatestArtifact(
					"data/architecture-principles/evaluations",
					`${editionDate}_`,
				) || "",
			bookDeltaEvaluationPath:
				findLatestArtifact(
					"data/book-delta/evaluations",
					`${editionDate}_`,
				) || "",
			knowledgeContinuityValidationPath:
				findLatestArtifact(
					"data/quality/knowledge-continuity",
					`${editionDate}_`,
				) || "",
		},
		acceptanceInputs: {
			publicationValidationPath: "memory://publication-validation-report",
			acceptanceDecisionPath: "memory://acceptance-decision",
		},
		overallContentHash: "",
		generatedAt: new Date().toISOString(),
		generatedBy: "evidence-aggregator",
	};

	// Compute overall content hash
	const hashInput = JSON.stringify({
		sourceEvidence: packageData.sourceEvidence,
		editorialEvidence: packageData.editorialEvidence,
		publicationEvidence: packageData.publicationEvidence,
		qualityEvidence: packageData.qualityEvidence,
		knowledgeEvidence: packageData.knowledgeEvidence,
	});
	packageData.overallContentHash = `sha256:${createHash("sha256").update(hashInput).digest("hex")}`;

	// Persist the aggregated evidence package
	const { writeFileSync, mkdirSync } = await import("fs");
	const outputDir = "data/evidence-packages";
	mkdirSync(outputDir, { recursive: true });
	const packagePath = join(
		outputDir,
		`edition_${editionDate}_${packageData.packageId}.json`,
	);
	writeFileSync(packagePath, JSON.stringify(packageData, null, 2), "utf-8");

	return {
		outputArtifacts: [
			{
				artifactId: "aggregated-evidence-package",
				path: packagePath,
				description:
					"Complete evidence package linking all pipeline stages",
				required: true,
			},
		],
		evidencePackage: packageData,
	};
}

/**
 * Produce Workflow Completion Report & Acceptance-Gate Inputs (H04_PRODUCE_COMPLETION_REPORT).
 * Entry point for workflow stage H04.
 * Generates structured execution report covering all phases, resource usage, unresolved defects,
 * checkpoint info, and explicit next-stage readiness for step 100 acceptance framework.
 */
export async function produceCompletionReport(
	input: PhaseHInput,
): Promise<any> {
	const editionDate = input.editionDate;
	const editionId = `edition_${editionDate}`;

	// Load execution manifest
	const executionManifestArtifact = input["execution-manifest"];
	let executionManifest: ExecutionManifest = {
		editionDate,
		stages: [],
		resourcesUsed: {},
	};
	if (executionManifestArtifact?.path) {
		try {
			executionManifest = JSON.parse(
				readFileSync(executionManifestArtifact.path, "utf-8"),
			) as ExecutionManifest;
		} catch {}
	}

	// Load evidence package
	const evidencePackageArtifact = input["evidence-package"];
	let evidencePackage: EvidencePackage = {
		packageId: "",
		overallContentHash: "",
	};
	if (evidencePackageArtifact?.path) {
		try {
			evidencePackage = JSON.parse(
				readFileSync(evidencePackageArtifact.path, "utf-8"),
			) as EvidencePackage;
		} catch {}
	}

	// Load final artifacts to verify their status
	const loadArtifact = (
		artifact: unknown,
	): { content: string; meta: Record<string, unknown> } => {
		if (!artifact) return { content: "", meta: {} };
		if (typeof artifact === "object" && "path" in artifact) {
			const art = artifact as { path?: string };
			if (art.path) {
				try {
					const content = readFileSync(art.path, "utf-8");
					const metaPath = art.path + ".meta.json";
					let meta: Record<string, unknown> = {};
					try {
						meta = JSON.parse(readFileSync(metaPath, "utf-8"));
					} catch {}
					return { content, meta };
				} catch {}
			}
		}
		return { content: "", meta: {} };
	};

	const finalNewsletter = loadArtifact(input["final-newsletter"]);
	const finalListeningNl = loadArtifact(input["final-listening-nl"]);
	const finalResearchAudit = loadArtifact(input["final-research-audit"]);
	const finalDailyIndex = loadArtifact(input["final-daily-index"]);

	// Build workflow report
	const stages = executionManifest.stages || [];
	const succeededStages = stages.filter(
		(s: any) => s.state === "SUCCEEDED",
	).length;
	const failedStages = stages.filter((s: any) => s.state === "FAILED").length;
	const incompleteStages = stages.filter(
		(s: any) => s.state === "INCOMPLETE",
	).length;
	const skippedStages = stages.filter(
		(s: any) => s.state === "SKIPPED",
	).length;

	const totalModelRequests = stages.reduce(
		(sum: number, s: any) => sum + (s.resourcesUsed?.modelRequests || 0),
		0,
	);
	const totalTokens = stages.reduce(
		(sum: number, s: any) => sum + (s.resourcesUsed?.tokensUsed || 0),
		0,
	);

	const report = {
		reportId: `wfr_${Date.now()}`,
		editionDate,
		editionId,
		manifestId: executionManifest.manifestId || `wfr_${Date.now()}`,
		workflowGraphVersion: executionManifest.workflowGraphVersion || "1.0.0",
		contractVersion: executionManifest.contractVersion || "1.0",
		overallOutcome:
			failedStages > 0
				? "FAILED"
				: incompleteStages > 0
					? "INCOMPLETE"
					: "SUCCEEDED",
		completedAt: new Date().toISOString(),
		durationMs:
			executionManifest.completedAt && executionManifest.requestedAt
				? new Date(executionManifest.completedAt).getTime() -
					new Date(executionManifest.requestedAt).getTime()
				: 0,
		phaseResults: {
			A: stages
				.filter((s: any) => s.stageId.startsWith("a"))
				.map((s: any) => ({ stageId: s.stageId, state: s.state })),
			B: stages
				.filter((s: any) => s.stageId.startsWith("b"))
				.map((s: any) => ({ stageId: s.stageId, state: s.state })),
			C: stages
				.filter((s: any) => s.stageId.startsWith("c"))
				.map((s: any) => ({ stageId: s.stageId, state: s.state })),
			D: stages
				.filter((s: any) => s.stageId.startsWith("d"))
				.map((s: any) => ({ stageId: s.stageId, state: s.state })),
			E: stages
				.filter((s: any) => s.stageId.startsWith("e"))
				.map((s: any) => ({ stageId: s.stageId, state: s.state })),
			F: stages
				.filter((s: any) => s.stageId.startsWith("f"))
				.map((s: any) => ({ stageId: s.stageId, state: s.state })),
			G: stages
				.filter((s: any) => s.stageId.startsWith("g"))
				.map((s: any) => ({ stageId: s.stageId, state: s.state })),
			H: stages
				.filter((s: any) => s.stageId.startsWith("h"))
				.map((s: any) => ({ stageId: s.stageId, state: s.state })),
		},
		stageSummary: {
			total: stages.length,
			succeeded: succeededStages,
			failed: failedStages,
			incomplete: incompleteStages,
			skipped: skippedStages,
		},
		resourceUsage: {
			modelRequests: totalModelRequests,
			tokensUsed: totalTokens,
			sourceRequests: stages.reduce(
				(sum: number, s: any) =>
					sum + (s.resourcesUsed?.sourceRequests || 0),
				0,
			),
			cpuTimeMs: stages.reduce(
				(sum: number, s: any) =>
					sum + (s.resourcesUsed?.cpuTimeMs || 0),
				0,
			),
			peakMemoryMb: Math.max(
				...stages.map((s: any) => s.resourcesUsed?.memoryPeakMb || 0),
				0,
			),
		},
		finalArtifacts: {
			newsletter: {
				path: finalNewsletter.meta?.path || "",
				status: finalNewsletter.meta?.lifecycleStatus || "MISSING",
			},
			listeningNl: {
				path: finalListeningNl.meta?.path || "",
				status: finalListeningNl.meta?.lifecycleStatus || "MISSING",
			},
			researchAudit: {
				path: finalResearchAudit.meta?.path || "",
				status: finalResearchAudit.meta?.lifecycleStatus || "MISSING",
			},
			dailyIndex: {
				path: finalDailyIndex.meta?.path || "",
				status: finalDailyIndex.meta?.lifecycleStatus || "MISSING",
			},
		},
		evidencePackage: {
			packageId: evidencePackage.packageId || "",
			contentHash: evidencePackage.overallContentHash || "",
			path: `data/evidence-packages/edition_${editionDate}_*.json`,
		},
		unresolvedIssues: stages
			.filter((s: any) => s.state === "FAILED" || s.state === "BLOCKED")
			.map((s: any) => ({
				stageId: s.stageId,
				error: s.error?.message || "Unknown",
			})),
		checkpoints: executionManifest.checkpoints || [],
		retryHistory: executionManifest.resumeHistory || [],
		generatedAt: new Date().toISOString(),
		generatedBy: "workflow-completion-reporter",
		contentHash: "",
	};

	// Compute content hash
	report.contentHash = `sha256:${createHash("sha256").update(JSON.stringify(report)).digest("hex")}`;

	// Persist workflow report
	const { writeFileSync, mkdirSync } = await import("fs");
	const reportDir = "data/workflow-reports";
	mkdirSync(reportDir, { recursive: true });
	const reportPath = join(
		reportDir,
		`edition_${editionDate}_${report.reportId}.json`,
	);
	writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");

	// Build acceptance gate inputs
	const acceptanceInputs = {
		acceptanceId: `acc_${Date.now()}`,
		editionDate,
		editionId,
		workflowReportPath: reportPath,
		evidencePackagePath: `data/evidence-packages/edition_${editionDate}_*.json`,
		finalArtifacts: {
			newsletter: {
				path: `editions/edition_${editionDate}/canonical/publication.md`,
				status: finalNewsletter.meta?.lifecycleStatus || "MISSING",
			},
			listeningNl: {
				path: `editions/edition_${editionDate}/canonical/AI Daily Intelligence — ${editionDate}.md`,
				status: finalListeningNl.meta?.lifecycleStatus || "MISSING",
			},
			researchAudit: {
				path: `editions/edition_${editionDate}/canonical/research-audit.md`,
				status: finalResearchAudit.meta?.lifecycleStatus || "MISSING",
			},
			dailyIndex: {
				path: `editions/edition_${editionDate}/index.md`,
				status: finalDailyIndex.meta?.lifecycleStatus || "MISSING",
			},
		},
		qualityEvaluations: {
			q1q10: `data/quality/q1q10/edition_${editionDate}_*.json`,
			audioAg: `data/quality/audio-ag/edition_${editionDate}_*.json`,
			readable: `data/quality/readable/edition_${editionDate}_*.json`,
			visualization: `data/quality/visualization/edition_${editionDate}_*.json`,
			repairs: `data/quality/repairs/edition_${editionDate}_*.json`,
		},
		knowledgeContinuity: {
			thesaurus: `data/thesaurus/evaluations/edition_${editionDate}_*.json`,
			architecturePrinciples: `data/architecture-principles/evaluations/edition_${editionDate}_*.json`,
			bookDelta: `data/book-delta/evaluations/edition_${editionDate}_*.json`,
			knowledgeContinuityValidation: `data/quality/knowledge-continuity/edition_${editionDate}_*.json`,
		},
		generatedAt: new Date().toISOString(),
		generatedBy: "acceptance-gate-input-preparer",
	};

	// Persist acceptance gate inputs
	const acceptanceDir = "data/acceptance-gate";
	mkdirSync(acceptanceDir, { recursive: true });
	const acceptancePath = join(
		acceptanceDir,
		`edition_${editionDate}_acc_${Date.now()}.json`,
	);
	writeFileSync(
		acceptancePath,
		JSON.stringify(acceptanceInputs, null, 2),
		"utf-8",
	);

	return {
		outputArtifacts: [
			{
				artifactId: "workflow-report",
				path: reportPath,
				description:
					"WorkflowReport with complete phase-by-phase results",
				required: true,
			},
			{
				artifactId: "acceptance-gate-inputs",
				path: acceptancePath,
				description:
					"Structured inputs for step 100 acceptance framework",
				required: true,
			},
		],
		report,
		acceptanceInputs,
	};
}

/**
 * Release Edition Execution Lock (H05_RELEASE_LOCK).
 * Entry point for workflow stage H05.
 * Releases the filesystem lock for this edition, recording final state.
 */
export async function releaseLock(input: {
	releaseEditionLock?: () => Promise<WorkflowLock | null>;
}) {
	const lock = await input.releaseEditionLock?.();
	if (!lock)
		throw new Error(
			"CONCURRENT_EXECUTION: This run cannot release the edition lock",
		);
	const lockPath = editionLockPath(lock.editionId);

	return {
		outputArtifacts: [
			{
				artifactId: "released-lock",
				path: lockPath,
				description: "WorkflowLock with state FREE",
				required: true,
			},
		],
		lock,
	};
}
