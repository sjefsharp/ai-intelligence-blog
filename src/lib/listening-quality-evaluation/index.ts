/**
 * Listening Quality Evaluation — Public API
 *
 * Single entry point for the listening quality evaluation module.
 */

export * from "./schema.js";
export * from "./evaluator.js";
export * from "./audio-evaluator.js";

import { evaluateListeningQuality } from "./evaluator.js";
import { readFileSync } from "fs";
import { randomBytes, createHash } from "crypto";

/**
 * Coerce LLM output to match strict Zod schemas.
 * Free-tier models often return strings where objects are expected.
 * This normalizes passageReferences, evidence, and other structured fields.
 */
function coerceEvaluationOutput(obj: any): any {
	if (!obj || typeof obj !== "object") return obj;

	// Handle arrays
	if (Array.isArray(obj)) {
		return obj.map(coerceEvaluationOutput);
	}

	// Handle passageReferences - convert strings to PassageReference objects
	if (obj.passageReferences && Array.isArray(obj.passageReferences)) {
		obj.passageReferences = obj.passageReferences.map((ref: any) => {
			if (typeof ref === "string") {
				// Convert string reference to proper object
				return {
					characterOffset: 0,
					lineNumber: 1,
					sectionHeading: undefined,
					quote: ref.slice(0, 500),
					storyId: undefined,
				};
			}
			if (ref && typeof ref === "object") {
				// Ensure required fields exist
				return {
					characterOffset: ref.characterOffset ?? 0,
					lineNumber: ref.lineNumber ?? 1,
					sectionHeading: ref.sectionHeading ?? undefined,
					quote: ref.quote ?? "",
					storyId: ref.storyId ?? undefined,
				};
			}
			return {
				characterOffset: 0,
				lineNumber: 1,
				sectionHeading: undefined,
				quote: "",
				storyId: undefined,
			};
		});
	}

	// Handle evidence array - ensure passageReferences in each evidence item
	if (obj.evidence && Array.isArray(obj.evidence)) {
		obj.evidence = obj.evidence.map((ev: any) => {
			if (ev && typeof ev === "object") {
				if (
					ev.passageReferences &&
					Array.isArray(ev.passageReferences)
				) {
					ev.passageReferences = ev.passageReferences.map(
						(ref: any) => {
							if (typeof ref === "string") {
								return {
									characterOffset: 0,
									lineNumber: 1,
									sectionHeading: undefined,
									quote: ref.slice(0, 500),
									storyId: undefined,
								};
							}
							if (ref && typeof ref === "object") {
								return {
									characterOffset: ref.characterOffset ?? 0,
									lineNumber: ref.lineNumber ?? 1,
									sectionHeading:
										ref.sectionHeading ?? undefined,
									quote: ref.quote ?? "",
									storyId: ref.storyId ?? undefined,
								};
							}
							return {
								characterOffset: 0,
								lineNumber: 1,
								sectionHeading: undefined,
								quote: "",
								storyId: undefined,
							};
						},
					);
				}
			}
			return ev;
		});
	}

	// Handle affectedPassage in repair actions
	if (obj.affectedPassage) {
		if (typeof obj.affectedPassage === "string") {
			obj.affectedPassage = {
				characterOffset: 0,
				lineNumber: 1,
				sectionHeading: undefined,
				quote: obj.affectedPassage.slice(0, 500),
				storyId: undefined,
			};
		} else if (
			obj.affectedPassage &&
			typeof obj.affectedPassage === "object"
		) {
			obj.affectedPassage = {
				characterOffset: obj.affectedPassage.characterOffset ?? 0,
				lineNumber: obj.affectedPassage.lineNumber ?? 1,
				sectionHeading: obj.affectedPassage.sectionHeading ?? undefined,
				quote: obj.affectedPassage.quote ?? "",
				storyId: obj.affectedPassage.storyId ?? undefined,
			};
		}
	}

	// Recursively process all object properties
	for (const key of Object.keys(obj)) {
		if (
			key !== "passageReferences" &&
			key !== "evidence" &&
			key !== "affectedPassage"
		) {
			obj[key] = coerceEvaluationOutput(obj[key]);
		}
	}

	return obj;
}

/**
 * Evaluate Listening Quality Q1-Q10 (F01_Q1Q10_EVALUATION).
 * Entry point for workflow stage F01.
 */
export async function evaluateListeningQualityWrapper(
	input: any,
): Promise<any> {
	const editionDate = input.editionDate;
	const editionId = `edition_${editionDate}`;

	// Load listening narrative markdown from artifact path
	const listeningNarrativeArtifact =
		input["listening-nl-md"] || input.listeningNlMd;
	let listeningNarrativeMarkdown = "";
	let listeningNarrativeArtifactId = "";
	let listeningNarrativeTraceability: any = {
		segments: [],
		claimCoverage: [],
		sourceCoverage: [],
		storyCoverage: [],
	};

	if (listeningNarrativeArtifact) {
		if (listeningNarrativeArtifact.path) {
			listeningNarrativeMarkdown = readFileSync(
				listeningNarrativeArtifact.path,
				"utf-8",
			);
			listeningNarrativeArtifactId =
				listeningNarrativeArtifact.artifactId || "";
		} else if (typeof listeningNarrativeArtifact === "string") {
			listeningNarrativeMarkdown = readFileSync(
				listeningNarrativeArtifact,
				"utf-8",
			);
		} else {
			listeningNarrativeMarkdown =
				listeningNarrativeArtifact.markdown ||
				listeningNarrativeArtifact.content ||
				"";
			listeningNarrativeArtifactId =
				listeningNarrativeArtifact.artifactId || "";
		}
	}

	// Load traceability and artifactId from metadata file
	if (listeningNarrativeArtifact?.path) {
		try {
			const metaPath = listeningNarrativeArtifact.path + ".meta.json";
			const meta = JSON.parse(readFileSync(metaPath, "utf-8"));
			listeningNarrativeTraceability =
				meta.traceability || listeningNarrativeTraceability;
			listeningNarrativeArtifactId =
				meta.artifactId || listeningNarrativeArtifactId;
		} catch {}
	}

	// Ensure artifactId matches required pattern
	if (
		!listeningNarrativeArtifactId ||
		!/^pubart_[a-z0-9]{16}$/.test(listeningNarrativeArtifactId)
	) {
		listeningNarrativeArtifactId = `pubart_${randomBytes(8).toString("hex")}`;
	}

	// Load fact dossier
	const factDossierArtifact =
		input["canonical-fact-dossier"] || input.canonicalFactDossier;
	let factDossier: any = {
		candidates: [],
		editionDate,
		editionWindow: { start: "", end: "", timezone: "Europe/Amsterdam" },
		contentHash: "",
		dossierId: `fd_${randomBytes(8).toString("hex")}`,
	};
	if (factDossierArtifact) {
		if (factDossierArtifact.path) {
			factDossier = JSON.parse(
				readFileSync(factDossierArtifact.path, "utf-8"),
			);
		} else if (typeof factDossierArtifact === "string") {
			factDossier = JSON.parse(
				readFileSync(factDossierArtifact, "utf-8"),
			);
		} else if (factDossierArtifact.candidates !== undefined) {
			factDossier = factDossierArtifact;
		}
	}

	// Ensure factDossier has required fields
	if (!factDossier.dossierId && factDossier.contentHash) {
		factDossier.dossierId = `fd_${randomBytes(8).toString("hex")}`;
	}
	if (!factDossier.contentHash) {
		factDossier.contentHash = `sha256:${createHash("sha256").update(JSON.stringify(factDossier)).digest("hex")}`;
	}
	if (!factDossier.editionSummary) {
		factDossier.editionSummary = {
			totalCandidates: factDossier.candidates?.length || 0,
			totalClaims: 0,
			byResearchDomain: {},
			byTemporalEligibility: {},
			byEvidenceClassification: {},
			byVerificationStatus: {},
			candidatesWithEvidenceGaps: 0,
			claimsWithCounterevidence: 0,
			claimsWithUnresolvedUncertainties: 0,
			strategicResearchCandidates: 0,
			technicalCandidates: 0,
			averageClaimConfidence: 0,
		};
	}

	// Load editorial manifest
	const editorialManifestArtifact =
		input["resolved-editorial-manifest"] || input.resolvedEditorialManifest;
	let editorialManifest: any = {
		stories: [],
		candidates: [],
		editionDate,
		manifestId: `esm_${randomBytes(8).toString("hex")}`,
		contentHash: "",
	};
	if (editorialManifestArtifact) {
		if (editorialManifestArtifact.path) {
			editorialManifest = JSON.parse(
				readFileSync(editorialManifestArtifact.path, "utf-8"),
			);
		} else if (typeof editorialManifestArtifact === "string") {
			editorialManifest = JSON.parse(
				readFileSync(editorialManifestArtifact, "utf-8"),
			);
		} else if (editorialManifestArtifact.stories !== undefined) {
			editorialManifest = editorialManifestArtifact;
		}
	}

	// Ensure editorialManifest has required fields
	if (!editorialManifest.manifestId) {
		editorialManifest.manifestId = `esm_${randomBytes(8).toString("hex")}`;
	}
	if (!editorialManifest.contentHash) {
		editorialManifest.contentHash = `sha256:${createHash("sha256").update(JSON.stringify(editorialManifest)).digest("hex")}`;
	}
	if (!editorialManifest.concentrationReview) {
		editorialManifest.concentrationReview = {
			findings: [],
			correctionsApplied: [],
			reviewedAt: new Date().toISOString(),
			ringDistribution: {},
			organizationDistribution: {},
			claimTypeDistribution: {},
			rankingInconsistenciesFound: 0,
			residualRisks: [],
			modelAssisted: false,
			note: "No concentration review performed.",
			selectedStoryCount:
				editorialManifest.stories?.filter(
					(s: any) =>
						s.decision === "SELECTED" ||
						s.decision === "CATCH_UP_SELECTED",
				).length || 0,
			consistencyChecks: [],
		};
	}

	// Load historical regression (optional)
	const historicalRegressionArtifact =
		input["historical-regression-report"] ||
		input.historicalRegressionReport;
	let historicalRegression: any = null;
	if (historicalRegressionArtifact) {
		if (historicalRegressionArtifact.path) {
			historicalRegression = JSON.parse(
				readFileSync(historicalRegressionArtifact.path, "utf-8"),
			);
		} else if (typeof historicalRegressionArtifact === "string") {
			historicalRegression = JSON.parse(
				readFileSync(historicalRegressionArtifact, "utf-8"),
			);
		} else if (historicalRegressionArtifact.reportId !== undefined) {
			historicalRegression = historicalRegressionArtifact;
		}
	}

	// Load publication metadata
	const publicationMetadataArtifact =
		input["listening-nl-md"] || input.listeningNlMd;
	let publicationMetadata: any = {
		artifactId: listeningNarrativeArtifactId,
		editionId,
		editionDate,
		contentType: "listening-narrative",
		language: "nl",
		canonicalFilename: "",
		title: "",
		description: "",
		lifecycleStatus: "DRAFT",
		validationStatus: "pending",
	};
	if (publicationMetadataArtifact?.path) {
		try {
			const metaPath = publicationMetadataArtifact.path + ".meta.json";
			publicationMetadata = JSON.parse(readFileSync(metaPath, "utf-8"));
		} catch {}
	}

	// Ensure publicationMetadata has required artifactId
	if (
		!publicationMetadata.artifactId ||
		!/^pubart_[a-z0-9]{16}$/.test(publicationMetadata.artifactId)
	) {
		publicationMetadata.artifactId = listeningNarrativeArtifactId;
	}

	// Load article identities (from editorial manifest)
	const articleIdentities =
		editorialManifest.stories?.map((s: any) => ({
			articleId: s.storyId || s.candidateId || "",
			sourceReferences: s.sourceReferences || [],
			claimIds: s.claimIds || [],
			researchDomains: s.researchDomains || [],
			organizations: s.organizations || [],
		})) || [];

	// Call the actual evaluation function
	const report = await evaluateListeningQuality({
		editionDate,
		editionId,
		listeningNarrativeMarkdown,
		listeningNarrativeArtifactId,
		listeningNarrativeTraceability,
		factDossier,
		editorialManifest,
		historicalRegression,
		publicationMetadata,
		articleIdentities,
		validationMode: input.validationMode || false,
	});

	// Coerce LLM output to match strict schemas
	const coercedReport = coerceEvaluationOutput(report);

	return coercedReport;
}

/**
 * Evaluate Audio A-G Holistic Listening Quality (F02_AUDIO_A_G_EVALUATION).
 * Entry point for workflow stage F02.
 */
export async function evaluateAudioQualityWrapper(input: any): Promise<any> {
	const editionDate = input.editionDate;
	const editionId = `edition_${editionDate}`;

	// Load listening narrative markdown from artifact path
	const listeningNarrativeArtifact =
		input["listening-nl-md"] || input.listeningNlMd;
	let listeningNarrativeMarkdown = "";
	let listeningNarrativeArtifactId = "";
	let listeningNarrativeTraceability: any = {
		segments: [],
		claimCoverage: [],
		sourceCoverage: [],
		storyCoverage: [],
	};

	if (listeningNarrativeArtifact) {
		if (listeningNarrativeArtifact.path) {
			listeningNarrativeMarkdown = readFileSync(
				listeningNarrativeArtifact.path,
				"utf-8",
			);
			listeningNarrativeArtifactId =
				listeningNarrativeArtifact.artifactId || "";
		} else if (typeof listeningNarrativeArtifact === "string") {
			listeningNarrativeMarkdown = readFileSync(
				listeningNarrativeArtifact,
				"utf-8",
			);
		} else {
			listeningNarrativeMarkdown =
				listeningNarrativeArtifact.markdown ||
				listeningNarrativeArtifact.content ||
				"";
			listeningNarrativeArtifactId =
				listeningNarrativeArtifact.artifactId || "";
		}
	}

	// Load traceability and artifactId from metadata file
	if (listeningNarrativeArtifact?.path) {
		try {
			const metaPath = listeningNarrativeArtifact.path + ".meta.json";
			const meta = JSON.parse(readFileSync(metaPath, "utf-8"));
			listeningNarrativeTraceability =
				meta.traceability || listeningNarrativeTraceability;
			listeningNarrativeArtifactId =
				meta.artifactId || listeningNarrativeArtifactId;
		} catch {}
	}

	// Ensure artifactId matches required pattern
	if (
		!listeningNarrativeArtifactId ||
		!/^pubart_[a-z0-9]{16}$/.test(listeningNarrativeArtifactId)
	) {
		listeningNarrativeArtifactId = `pubart_${randomBytes(8).toString("hex")}`;
	}

	// Load fact dossier
	const factDossierArtifact =
		input["canonical-fact-dossier"] || input.canonicalFactDossier;
	let factDossier: any = {
		candidates: [],
		editionDate,
		editionWindow: { start: "", end: "", timezone: "Europe/Amsterdam" },
		contentHash: "",
		dossierId: `fd_${randomBytes(8).toString("hex")}`,
	};
	if (factDossierArtifact) {
		if (factDossierArtifact.path) {
			factDossier = JSON.parse(
				readFileSync(factDossierArtifact.path, "utf-8"),
			);
		} else if (typeof factDossierArtifact === "string") {
			factDossier = JSON.parse(
				readFileSync(factDossierArtifact, "utf-8"),
			);
		} else if (factDossierArtifact.candidates !== undefined) {
			factDossier = factDossierArtifact;
		}
	}

	// Ensure factDossier has required fields
	if (!factDossier.dossierId && factDossier.contentHash) {
		factDossier.dossierId = `fd_${randomBytes(8).toString("hex")}`;
	}
	if (!factDossier.contentHash) {
		factDossier.contentHash = `sha256:${createHash("sha256").update(JSON.stringify(factDossier)).digest("hex")}`;
	}
	if (!factDossier.editionSummary) {
		factDossier.editionSummary = {
			totalCandidates: factDossier.candidates?.length || 0,
			totalClaims: 0,
			byResearchDomain: {},
			byTemporalEligibility: {},
			byEvidenceClassification: {},
			byVerificationStatus: {},
			candidatesWithEvidenceGaps: 0,
			claimsWithCounterevidence: 0,
			claimsWithUnresolvedUncertainties: 0,
			strategicResearchCandidates: 0,
			technicalCandidates: 0,
			averageClaimConfidence: 0,
		};
	}

	// Load editorial manifest
	const editorialManifestArtifact =
		input["resolved-editorial-manifest"] || input.resolvedEditorialManifest;
	let editorialManifest: any = {
		stories: [],
		candidates: [],
		editionDate,
		manifestId: `esm_${randomBytes(8).toString("hex")}`,
		contentHash: "",
	};
	if (editorialManifestArtifact) {
		if (editorialManifestArtifact.path) {
			editorialManifest = JSON.parse(
				readFileSync(editorialManifestArtifact.path, "utf-8"),
			);
		} else if (typeof editorialManifestArtifact === "string") {
			editorialManifest = JSON.parse(
				readFileSync(editorialManifestArtifact, "utf-8"),
			);
		} else if (editorialManifestArtifact.stories !== undefined) {
			editorialManifest = editorialManifestArtifact;
		}
	}

	// Ensure editorialManifest has required fields
	if (!editorialManifest.manifestId) {
		editorialManifest.manifestId = `esm_${randomBytes(8).toString("hex")}`;
	}
	if (!editorialManifest.contentHash) {
		editorialManifest.contentHash = `sha256:${createHash("sha256").update(JSON.stringify(editorialManifest)).digest("hex")}`;
	}
	if (!editorialManifest.concentrationReview) {
		editorialManifest.concentrationReview = {
			findings: [],
			correctionsApplied: [],
			reviewedAt: new Date().toISOString(),
			ringDistribution: {},
			organizationDistribution: {},
			claimTypeDistribution: {},
			rankingInconsistenciesFound: 0,
			residualRisks: [],
			modelAssisted: false,
			note: "No concentration review performed.",
			selectedStoryCount:
				editorialManifest.stories?.filter(
					(s: any) =>
						s.decision === "SELECTED" ||
						s.decision === "CATCH_UP_SELECTED",
				).length || 0,
			consistencyChecks: [],
		};
	}

	// Load historical regression (optional)
	const historicalRegressionArtifact =
		input["historical-regression-report"] ||
		input.historicalRegressionReport;
	let historicalRegression: any = null;
	if (historicalRegressionArtifact) {
		if (historicalRegressionArtifact.path) {
			historicalRegression = JSON.parse(
				readFileSync(historicalRegressionArtifact.path, "utf-8"),
			);
		} else if (typeof historicalRegressionArtifact === "string") {
			historicalRegression = JSON.parse(
				readFileSync(historicalRegressionArtifact, "utf-8"),
			);
		} else if (historicalRegressionArtifact.reportId !== undefined) {
			historicalRegression = historicalRegressionArtifact;
		}
	}

	// Load publication metadata
	const publicationMetadataArtifact =
		input["listening-nl-md"] || input.listeningNlMd;
	let publicationMetadata: any = {
		artifactId: listeningNarrativeArtifactId,
		editionId,
		editionDate,
		contentType: "listening-narrative",
		language: "nl",
		canonicalFilename: "",
		title: "",
		description: "",
		lifecycleStatus: "DRAFT",
		validationStatus: "pending",
	};
	if (publicationMetadataArtifact?.path) {
		try {
			const metaPath = publicationMetadataArtifact.path + ".meta.json";
			publicationMetadata = JSON.parse(readFileSync(metaPath, "utf-8"));
		} catch {}
	}

	// Ensure publicationMetadata has required artifactId
	if (
		!publicationMetadata.artifactId ||
		!/^pubart_[a-z0-9]{16}$/.test(publicationMetadata.artifactId)
	) {
		publicationMetadata.artifactId = listeningNarrativeArtifactId;
	}

	// Load article identities (from editorial manifest)
	const articleIdentities =
		editorialManifest.stories?.map((s: any) => ({
			articleId: s.storyId || s.candidateId || "",
			sourceReferences: s.sourceReferences || [],
			claimIds: s.claimIds || [],
			researchDomains: s.researchDomains || [],
			organizations: s.organizations || [],
		})) || [];

	// Load Q1-Q10 evaluation report if available
	const qEvaluationReportArtifact =
		input["q1q10-evaluation"] || input.q1q10Evaluation;
	let qEvaluationReport: any = null;
	if (qEvaluationReportArtifact) {
		if (qEvaluationReportArtifact.path) {
			qEvaluationReport = JSON.parse(
				readFileSync(qEvaluationReportArtifact.path, "utf-8"),
			);
		} else if (typeof qEvaluationReportArtifact === "string") {
			qEvaluationReport = JSON.parse(
				readFileSync(qEvaluationReportArtifact, "utf-8"),
			);
		} else if (
			qEvaluationReportArtifact.criterionEvaluations !== undefined
		) {
			qEvaluationReport = qEvaluationReportArtifact;
		}
	}

	// Call the actual evaluation function
	const { evaluateAudioQuality } = await import("./audio-evaluator.js");
	const result = await evaluateAudioQuality({
		editionDate,
		editionId,
		listeningNarrativeMarkdown,
		listeningNarrativeArtifactId,
		listeningNarrativeTraceability,
		factDossier,
		editorialManifest,
		historicalRegression,
		publicationMetadata,
		articleIdentities,
		validationMode: input.validationMode || false,
		qEvaluationReport,
	});

	// Coerce LLM output to match strict schemas
	const coercedResult = {
		evaluationReport: coerceEvaluationOutput(result.evaluationReport),
		holisticAssessment: coerceEvaluationOutput(result.holisticAssessment),
	};

	return coercedResult;
}
