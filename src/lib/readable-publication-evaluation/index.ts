/**
 * Readable Publication Quality Evaluation — Public API
 *
 * Single entry point for the readable publication quality evaluation module.
 * Re-exports all schemas, utilities, and functions.
 */

// Schema layer
export * from "./schema.js";

// Core evaluator
export * from "./evaluator.js";

import { evaluateReadableQuality } from "./evaluator.js";
import { readFileSync } from "fs";
import { randomBytes, createHash } from "crypto";

/**
 * Evaluate Readable Publication Quality (F03_READABLE_QUALITY_EVALUATION).
 * Entry point for workflow stage F03.
 */
export async function evaluateReadablePublication(input: any): Promise<any> {
	const editionDate = input.editionDate;
	const editionId = `edition_${editionDate}`;

	// Load Dutch publication markdown (newsletter)
	const newsletterArtifact = input["newsletter-md"] || input.newsletterMd;
	let dutchPublicationMarkdown = "";
	let dutchPublicationArtifactId = "";

	if (newsletterArtifact) {
		if (newsletterArtifact.path) {
			dutchPublicationMarkdown = readFileSync(
				newsletterArtifact.path,
				"utf-8",
			);
			dutchPublicationArtifactId = newsletterArtifact.artifactId || "";
		} else if (typeof newsletterArtifact === "string") {
			dutchPublicationMarkdown = readFileSync(
				newsletterArtifact,
				"utf-8",
			);
		} else {
			dutchPublicationMarkdown =
				newsletterArtifact.markdown || newsletterArtifact.content || "";
			dutchPublicationArtifactId = newsletterArtifact.artifactId || "";
		}
	}

	// Load research audit markdown
	const researchAuditArtifact =
		input["research-audit-md"] || input.researchAuditMd;
	let englishPublicationMarkdown = "";
	let englishPublicationArtifactId = "";

	if (researchAuditArtifact) {
		if (researchAuditArtifact.path) {
			englishPublicationMarkdown = readFileSync(
				researchAuditArtifact.path,
				"utf-8",
			);
			englishPublicationArtifactId =
				researchAuditArtifact.artifactId || "";
		} else if (typeof researchAuditArtifact === "string") {
			englishPublicationMarkdown = readFileSync(
				researchAuditArtifact,
				"utf-8",
			);
		} else {
			englishPublicationMarkdown =
				researchAuditArtifact.markdown ||
				researchAuditArtifact.content ||
				"";
			englishPublicationArtifactId =
				researchAuditArtifact.artifactId || "";
		}
	}

	// Ensure artifactIds match required pattern
	if (
		!dutchPublicationArtifactId ||
		!/^pubart_[a-z0-9]{16}$/.test(dutchPublicationArtifactId)
	) {
		dutchPublicationArtifactId = `pubart_${randomBytes(8).toString("hex")}`;
	}
	if (
		!englishPublicationArtifactId ||
		!/^pubart_[a-z0-9]{16}$/.test(englishPublicationArtifactId)
	) {
		englishPublicationArtifactId = `pubart_${randomBytes(8).toString("hex")}`;
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
		input["newsletter-md"] || input.newsletterMd;
	let publicationMetadata: any = {
		artifactId: dutchPublicationArtifactId,
		editionId,
		editionDate,
		contentType: "newsletter",
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
		publicationMetadata.artifactId = dutchPublicationArtifactId;
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

	// Load visualizations (optional)
	const visualizationsArtifact = input["visual-assets"] || input.visualAssets;
	let visualizations: any[] = [];
	if (visualizationsArtifact) {
		// If it's a directory path, we'd load files from it
		// For now, pass empty array
		visualizations = [];
	}

	// Call the actual evaluation function
	const report = await evaluateReadableQuality({
		editionDate,
		editionId,
		dutchPublicationMarkdown,
		dutchPublicationArtifactId,
		dutchPublicationTraceability: {
			segments: [],
			claimCoverage: [],
			sourceCoverage: [],
			storyCoverage: [],
		},
		englishPublicationMarkdown,
		englishPublicationArtifactId,
		englishPublicationTraceability: {
			segments: [],
			claimCoverage: [],
			sourceCoverage: [],
			storyCoverage: [],
		},
		factDossier,
		editorialManifest,
		historicalRegression,
		publicationMetadata,
		articleIdentities,
		visualizations,
		validationMode: input.validationMode || false,
	});

	return report;
}
