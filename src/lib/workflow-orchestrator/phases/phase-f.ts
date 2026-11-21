/** Phase F — Quality Assurance: Bounded Editorial Repairs */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { randomBytes, createHash } from "crypto";

interface RepairAction {
	repairActionId: string;
	criterionId: string;
	issueType: "factual" | "structural" | "explanatory" | "stylistic";
	problemDescription: string;
	affectedPassage: {
		characterOffset: number;
		lineNumber: number;
		sectionHeading?: string;
		quote: string;
		storyId?: string;
	};
	proposedCorrection: string;
	preservesCanonicalFacts: boolean;
	preservesEditorialSelection: boolean;
	status: "proposed" | "applied" | "rejected" | "escalated";
	appliedCorrection?: string;
	proposedAt: string;
	appliedAt?: string;
	regressionChecks: Array<{
		check: string;
		passed: boolean;
		details?: string;
	}>;
	residualUncertainty?: string;
}

interface RepairRecord {
	repairRecordId: string;
	editionDate: string;
	editionId: string;
	repairActions: RepairAction[];
	iterationBudget: {
		maxIterations: number;
		iterationsUsed: number;
	};
	downstreamRechecks: Array<{
		criterionId: string;
		recheckStatus: "passed" | "failed" | "unchanged";
		details: string;
	}>;
	residualFailures: Array<{
		criterionId: string;
		reason: string;
		escalated: boolean;
	}>;
	generatedAt: string;
	generatedBy: string;
	contentHash: string;
}

interface PhaseFInput {
	editionDate: string;
	"q1q10-evaluation"?: { path?: string } | string | object;
	"audio-ag-evaluation"?: { path?: string } | string | object;
	"readable-quality-evaluation"?: { path?: string } | string | object;
	"listening-nl-md"?: { path?: string } | string | object;
	"newsletter-md"?: { path?: string } | string | object;
	"research-audit-md"?: { path?: string } | string | object;
	"canonical-fact-dossier"?: { path?: string } | string | object;
	"resolved-editorial-manifest"?: { path?: string } | string | object;
}

/**
 * Execute bounded editorial repairs and regression checks.
 * Entry point for workflow stage F05_BOUNDED_REPAIRS.
 */
export async function executeBoundedRepairs(input: PhaseFInput): Promise<any> {
	const editionDate = input.editionDate;
	const editionId = `edition_${editionDate}`;

	// Load required evaluation reports
	const loadReport = (artifact: any): any => {
		if (!artifact) return null;
		if (artifact.path && typeof artifact.path === "string") {
			try {
				return JSON.parse(readFileSync(artifact.path, "utf-8"));
			} catch {
				return null;
			}
		}
		if (typeof artifact === "string") {
			try {
				return JSON.parse(readFileSync(artifact, "utf-8"));
			} catch {
				return null;
			}
		}
		return artifact;
	};

	const q1q10Report = loadReport(input["q1q10-evaluation"]);
	const audioAgReport = loadReport(input["audio-ag-evaluation"]);
	const readableReport = loadReport(input["readable-quality-evaluation"]);
	const factDossierArtifact = input["canonical-fact-dossier"];
	const editorialManifestArtifact = input["resolved-editorial-manifest"];

	// Load fact dossier and editorial manifest
	let factDossier = loadReport(factDossierArtifact);
	let editorialManifest = loadReport(editorialManifestArtifact);

	if (!factDossier) {
		factDossier = {
			candidates: [],
			editionDate,
			editionWindow: { start: "", end: "", timezone: "Europe/Amsterdam" },
		};
	}
	if (!editorialManifest) {
		editorialManifest = { stories: [], candidates: [], editionDate };
	}

	// Identify failed criteria from evaluation reports
	const failedCriteria: Array<{
		criterionId: string;
		report: string;
		evaluation: any;
	}> = [];

	const collectFailedCriteria = (report: any, reportName: string) => {
		if (!report || !report.criterionEvaluations) return;
		for (const eval_ of report.criterionEvaluations) {
			if (eval_.status === "FAIL") {
				failedCriteria.push({
					criterionId: eval_.criterionId,
					report: reportName,
					evaluation: eval_,
				});
			}
		}
	};

	collectFailedCriteria(q1q10Report, "q1q10");
	collectFailedCriteria(audioAgReport, "audio-ag");
	collectFailedCriteria(readableReport, "readable");

	// For each failed criterion, propose a repair action (bounded)
	const repairActions: RepairAction[] = [];
	const maxRepairIterations = 3;
	let iterationsUsed = 0;

	for (const failed of failedCriteria) {
		if (iterationsUsed >= maxRepairIterations) break;

		// Only attempt repairs for certain issue types
		const issueType = classifyIssueType(failed.evaluation);
		if (!["structural", "explanatory", "stylistic"].includes(issueType)) {
			// Skip factual issues - they require source verification, not text repair
			continue;
		}

		const repairAction: RepairAction = {
			repairActionId: `lqr_${randomBytes(8).toString("hex")}`,
			criterionId: failed.criterionId,
			issueType,
			problemDescription:
				failed.evaluation.summary ||
				`Failed ${failed.criterionId} in ${failed.report}`,
			affectedPassage: {
				characterOffset: 0,
				lineNumber: 1,
				quote: "Automated repair placeholder",
			},
			proposedCorrection: generateProposedCorrection(
				failed.evaluation,
				issueType,
			),
			preservesCanonicalFacts: true,
			preservesEditorialSelection: true,
			status: "proposed",
			proposedAt: new Date().toISOString(),
			regressionChecks: [],
			residualUncertainty:
				"Automated repair; requires human review before application",
		};

		repairActions.push(repairAction);
		iterationsUsed++;
	}

	// Apply repairs (in this minimal implementation, we just record them)
	// A full implementation would apply corrections to the publication artifacts
	// and rerun downstream quality checks

	const downstreamRechecks = failedCriteria.map((f) => ({
		criterionId: f.criterionId,
		recheckStatus: "unchanged" as const,
		details:
			"Repair not applied in minimal implementation; requires human review",
	}));

	const residualFailures = failedCriteria.map((f) => ({
		criterionId: f.criterionId,
		reason: "Automated repair not applied; requires human review",
		escalated: true,
	}));

	// Create repair record
	const repairRecord: RepairRecord = {
		repairRecordId: `rr_${randomBytes(8).toString("hex")}`,
		editionDate,
		editionId,
		repairActions,
		iterationBudget: {
			maxIterations: maxRepairIterations,
			iterationsUsed,
		},
		downstreamRechecks,
		residualFailures,
		generatedAt: new Date().toISOString(),
		generatedBy: "bounded-repair-engine",
		contentHash: `sha256:${createHash("sha256").update(JSON.stringify({ repairActions, downstreamRechecks, residualFailures })).digest("hex")}`,
	};

	// Persist repair record
	const outputDir = `data/quality/repairs`;
	mkdirSync(outputDir, { recursive: true });
	const recordPath = join(
		outputDir,
		`edition_${editionDate}_${repairRecord.repairRecordId}.json`,
	);
	writeFileSync(recordPath, JSON.stringify(repairRecord, null, 2), "utf-8");

	// Also write repair actions for downstream consumption
	const actionsPath = join(
		outputDir,
		`edition_${editionDate}_actions_${repairRecord.repairRecordId}.json`,
	);
	writeFileSync(
		actionsPath,
		JSON.stringify(
			{ repairActions, iterationBudget: repairRecord.iterationBudget },
			null,
			2,
		),
		"utf-8",
	);

	return {
		outputArtifacts: [
			{
				artifactId: "repair-record",
				path: recordPath,
				description:
					"RepairRecord with attempts, outcomes, downstream rechecks",
				required: true,
			},
		],
		repairRecord,
	};
}

function classifyIssueType(
	evaluation: any,
): "factual" | "structural" | "explanatory" | "stylistic" {
	const criterionId = evaluation.criterionId || "";
	const rationale = evaluation.rationale || "";

	// Simple heuristic based on criterion ID and rationale
	if (
		criterionId.startsWith("Q") &&
		["Q1", "Q3", "Q5", "Q7", "Q9"].includes(criterionId)
	) {
		return "factual";
	}
	if (criterionId.startsWith("A") || criterionId.startsWith("B")) {
		return "structural";
	}
	if (
		criterionId.startsWith("Q") &&
		["Q2", "Q4", "Q6", "Q8", "Q10"].includes(criterionId)
	) {
		return "explanatory";
	}
	if (
		rationale.toLowerCase().includes("tone") ||
		rationale.toLowerCase().includes("style")
	) {
		return "stylistic";
	}
	return "explanatory";
}

function generateProposedCorrection(
	evaluation: any,
	issueType: string,
): string {
	const criterionId = evaluation.criterionId || "";
	const rationale = evaluation.rationale || "";

	switch (issueType) {
		case "structural":
			return `[AUTO-REPAIR] Restructure ${criterionId} section for better flow: ${rationale}`;
		case "explanatory":
			return `[AUTO-REPAIR] Add clarification for ${criterionId}: ${rationale}`;
		case "stylistic":
			return `[AUTO-REPAIR] Adjust tone/style for ${criterionId}: ${rationale}`;
		default:
			return `[AUTO-REPAIR] Address ${criterionId}: ${rationale}`;
	}
}
