/**
 * Evidence Verification Engine — Core Verification Logic
 *
 * Implements systematic claim verification with evidence classification,
 * specialized verification for different claim types, contradiction analysis,
 * and temporal verification per AI Intelligence Publication Contract §4, §6.
 */

import crypto from "crypto";
import type {
	ClaimVerificationRecord,
	ClaimVerificationInput,
	EvidenceClassification,
	VerificationStatus,
	VerificationMethod,
	EvidenceReference,
	Counterevidence,
	RequiredAssumption,
	AlternativeExplanation,
	FalsificationCriterion,
	UnresolvedUncertainty,
	ClaimType,
	EvidenceTier,
} from "./types.js";

/** Generate a stable ID with prefix */
function generateId(prefix: string): string {
	const random = crypto.randomBytes(8).toString("hex");
	return `${prefix}_${random}`;
}

/** Calculate confidence based on evidence quality and classification */
export function calculateConfidence(
	evidence: EvidenceReference[],
	counterevidence: Counterevidence[],
	classification: EvidenceClassification,
	verificationLevel: "L0" | "L1" | "L2" | "L3",
): number {
	// Base confidence by classification
	const baseConfidence: Record<EvidenceClassification, number> = {
		VERIFIED_FACT: 0.95,
		RESEARCH_FINDING: 0.85,
		ORIGINAL_REPORTING: 0.8,
		EXPERT_INTERPRETATION: 0.7,
		VENDOR_CLAIM: 0.5,
		INFERENCE: 0.4,
		SPECULATION: 0.2,
		UNVERIFIED: 0.1,
	};

	let confidence = baseConfidence[classification] || 0.1;

	// Adjust for verification level
	const levelFactor = { L0: 0.7, L1: 0.85, L2: 0.95, L3: 1.0 }[
		verificationLevel
	];
	confidence *= levelFactor;

	// Adjust for evidence quality
	if (evidence.length > 0) {
		const avgEvidenceConfidence =
			evidence.reduce((sum, e) => sum + e.confidence, 0) /
			evidence.length;
		const primaryEvidenceCount = evidence.filter(
			(e) => e.evidenceRole === "primary",
		).length;
		const corroboratingCount = evidence.filter(
			(e) => e.evidenceRole === "corroborating",
		).length;

		confidence = (confidence + avgEvidenceConfidence) / 2;

		// Boost for multiple primary sources
		if (primaryEvidenceCount >= 2)
			confidence = Math.min(1.0, confidence + 0.1);
		// Boost for corroborating evidence
		if (corroboratingCount > 0)
			confidence = Math.min(1.0, confidence + 0.05 * corroboratingCount);
	}

	// Penalize for counterevidence
	if (counterevidence.length > 0) {
		const maxCounterConfidence = Math.max(
			...counterevidence.map((c) => c.confidence),
		);
		confidence *= 1 - maxCounterConfidence * 0.5;
	}

	return Math.max(0, Math.min(1, confidence));
}

/** Determine evidence classification based on evidence characteristics */
export function classifyEvidence(
	evidence: EvidenceReference[],
	claimType: ClaimType,
	sourceTier: EvidenceTier,
	hasIndependentReplication: boolean,
	hasMethodology: boolean,
	hasReproductionArtifact: boolean,
	isVendorSource: boolean,
	isOriginalReporting: boolean,
): EvidenceClassification {
	// Vendor claim without independent confirmation takes precedence: a vendor's own
	// assertion is never treated as verified fact even if it carries methodology.
	if (isVendorSource && !hasIndependentReplication && sourceTier >= 2) {
		return "VENDOR_CLAIM";
	}

	// Strongest: directly verifiable fact with primary evidence and either
	// independent replication or an explicitly verified primary source
	if (
		evidence.some((e) => e.evidenceRole === "primary") &&
		(hasIndependentReplication ||
			evidence.some((e) => e.classification === "VERIFIED_FACT"))
	) {
		return "VERIFIED_FACT";
	}

	// Research finding with methodology and study design
	if (
		(claimType === "scientific-research" ||
			claimType === "benchmark-result") &&
		hasMethodology &&
		evidence.some((e) => e.evidenceRole === "primary")
	) {
		return "RESEARCH_FINDING";
	}

	// Original reporting with first-hand disclosure
	if (
		isOriginalReporting &&
		evidence.some((e) => e.timestampType === "first-public-disclosure")
	) {
		return "ORIGINAL_REPORTING";
	}

	// Expert interpretation with evidence-informed analysis
	if (hasMethodology && sourceTier === 2 && !hasReproductionArtifact) {
		return "EXPERT_INTERPRETATION";
	}

	// Speculation: hypothesis lacking sufficient evidence (tier 3 without methodology)
	if (sourceTier === 3 && !hasMethodology) {
		return "SPECULATION";
	}

	// Inference: reasoned conclusion not directly established
	if (
		evidence.length > 0 &&
		!evidence.some((e) => e.evidenceRole === "primary")
	) {
		return "INFERENCE";
	}

	// Default: unverified (includes empty evidence)
	return "UNVERIFIED";
}

/** Check if a source is a vendor source */
export function isVendorSource(sourceId: string, sourceUrl: string): boolean {
	const vendorIndicators = [
		"openai.com",
		"anthropic.com",
		"google.com",
		"microsoft.com",
		"aws.amazon.com",
		"cloud.google.com",
		"azure.microsoft.com",
		"nvidia.com",
		"meta.com",
		"github.blog",
		"cloudflare.com",
		"mistral.ai",
		"cohere.com",
		"x.ai",
		"deepseek.com",
		"perplexity.ai",
		"huggingface.co",
		"langchain.com",
		"cursor.com",
		"windsurf.com",
		"zed.dev",
		"jetbrains.com",
		"apple.com",
		"vendor.com",
		"vendor",
		"blog.google",
		"deepmind.google",
	];
	return (
		vendorIndicators.some((v) => sourceUrl.includes(v)) ||
		vendorIndicators.some((v) => sourceId.includes(v.replace(".", "-")))
	);
}

/** Check if content represents original reporting */
export function isOriginalReporting(
	sourceId: string,
	sourceUrl: string,
	evidence: EvidenceReference[],
): boolean {
	const journalismSources = [
		"technologyreview.com",
		"theverge.com",
		"wired.com",
		"arstechnica.com",
		"reuters.com",
		"bloomberg.com",
		"ft.com",
		"wsj.com",
		"nytimes.com",
		"lwn.net",
		"queue.acm.org",
		"acmqueue.com",
	];
	const isJournalism = journalismSources.some((j) => sourceUrl.includes(j));
	const hasFirstDisclosure = evidence.some(
		(e) => e.timestampType === "first-public-disclosure",
	);
	return isJournalism && hasFirstDisclosure;
}

/** Verify technical announcement / software release claims */
function verifyTechnicalClaim(
	input: ClaimVerificationInput,
	evidence: EvidenceReference[],
): {
	classification: EvidenceClassification;
	status: VerificationStatus;
	methods: VerificationMethod[];
	details: ClaimVerificationRecord["verificationDetails"];
	technicalContext: ClaimVerificationRecord["technicalContext"];
	productContext: ClaimVerificationRecord["productContext"];
} {
	const methods: VerificationMethod[] = [
		"primary-source-inspection",
		"source-document-review",
		"api-documentation-check",
	];
	const isVendor = isVendorSource(input.sourceId, input.sourceUrl);

	// Check for GA vs preview vs experimental
	let releaseMaturity:
		"ga" | "preview" | "experimental" | "deprecated" | "unknown" =
		"unknown";
	let availability:
		"general" | "limited" | "waitlist" | "internal" | "unknown" = "unknown";

	for (const e of evidence) {
		const text = e.extractedText.toLowerCase();
		if (
			text.includes("generally available") ||
			text.includes("ga release") ||
			text.includes("general availability") ||
			(text.includes("for all") && text.includes("users"))
		) {
			releaseMaturity = "ga";
			availability = "general";
		} else if (
			text.includes("preview") ||
			text.includes("beta") ||
			text.includes("early access")
		) {
			releaseMaturity = "preview";
			availability = "limited";
		} else if (
			text.includes("experimental") ||
			text.includes("alpha") ||
			text.includes("research preview")
		) {
			releaseMaturity = "experimental";
			availability = "limited";
		} else if (
			text.includes("deprecated") ||
			text.includes("sunset") ||
			text.includes("end of life")
		) {
			releaseMaturity = "deprecated";
		}
		// Phased rollout restricts availability even when the feature itself is GA
		if (
			text.includes("rollout") ||
			text.includes("phased") ||
			text.includes("over the next") ||
			text.includes("begins today") ||
			text.includes("waitlist") ||
			text.includes("join the waitlist")
		) {
			availability =
				text.includes("waitlist") || text.includes("join the waitlist")
					? "waitlist"
					: "limited";
		}
	}

	// Check for version-specific behavior
	let version = "unknown";
	for (const e of evidence) {
		const versionMatch = e.extractedText.match(
			/v?(\d+\.\d+\.\d+(-[a-z0-9.]+)?)/i,
		);
		if (versionMatch) {
			version = versionMatch[1];
			break;
		}
	}

	// Check for reproduction artifact
	const hasReproductionArtifact = evidence.some(
		(e) =>
			e.extractedText.toLowerCase().includes("docker") ||
			e.extractedText.toLowerCase().includes("github.com/") ||
			e.extractedText.toLowerCase().includes("reproduc") ||
			e.applicableMethods.includes("artifact-reproduction"),
	);

	// Check for independent replication
	const hasIndependentReplication = evidence.some(
		(e) =>
			e.evidenceRole === "corroborating" && e.sourceId !== input.sourceId,
	);

	// Determine classification
	const isOrigReporting = isOriginalReporting(
		input.sourceId,
		input.sourceUrl,
		evidence,
	);
	const maxEvidenceTier = Math.max(
		...evidence.map((e) => e.tier || 1),
		1,
	) as EvidenceTier;
	const classification = classifyEvidence(
		evidence,
		input.claimType,
		maxEvidenceTier,
		hasIndependentReplication,
		true,
		hasReproductionArtifact,
		isVendor,
		isOrigReporting,
	);

	// Determine status
	let status: VerificationStatus = "unverified";
	if (classification === "VERIFIED_FACT") status = "verified";
	else if (classification === "VENDOR_CLAIM") status = "unverified";
	else if (classification === "RESEARCH_FINDING")
		status = "partially-verified";
	else if (classification === "ORIGINAL_REPORTING") status = "verified";
	else if (classification === "EXPERT_INTERPRETATION")
		status = "partially-verified";
	else if (classification === "INFERENCE") status = "unverified";
	else if (classification === "SPECULATION") status = "unverified";

	// Verification details for L1+
	const details: ClaimVerificationRecord["verificationDetails"] = {
		methodologyChecked: true,
		hardwareSpecified: evidence.some(
			(e) =>
				e.extractedText.toLowerCase().includes("gpu") ||
				e.extractedText.toLowerCase().includes("hardware"),
		),
		precisionStated: evidence.some(
			(e) =>
				e.extractedText.toLowerCase().includes("fp16") ||
				e.extractedText.toLowerCase().includes("bf16") ||
				e.extractedText.toLowerCase().includes("int8") ||
				e.extractedText.toLowerCase().includes("precision"),
		),
		batchSizeStated: evidence.some((e) =>
			e.extractedText.toLowerCase().includes("batch"),
		),
		warmupExcluded: false, // Would need deeper inspection
		statisticalRigor: false,
		confoundersAddressed: false,
		rawDataAvailable: hasReproductionArtifact,
		reproductionArtifact: hasReproductionArtifact
			? evidence.find((e) =>
					e.applicableMethods.includes("artifact-reproduction"),
				)?.url
			: undefined,
	};

	const technicalContext: ClaimVerificationRecord["technicalContext"] = {
		implementationStatus:
			releaseMaturity === "ga"
				? "released"
				: releaseMaturity === "preview"
					? "preview"
					: releaseMaturity === "experimental"
						? "research"
						: "unknown",
		knownLimitations: evidence.flatMap((e) => {
			const limitations: string[] = [];
			const text = e.extractedText.toLowerCase();
			if (
				text.includes("limitation") ||
				text.includes("caveat") ||
				text.includes("known issue")
			) {
				limitations.push(e.extractedText.slice(0, 200));
			}
			return limitations;
		}),
	};

	const productContext: ClaimVerificationRecord["productContext"] = {
		productName: input.sourceTitle,
		version,
		releaseMaturity,
		availability,
	};

	return {
		classification,
		status,
		methods,
		details,
		technicalContext,
		productContext,
	};
}

/** Verify scientific research / benchmark claims */
function verifyScientificClaim(
	input: ClaimVerificationInput,
	evidence: EvidenceReference[],
): {
	classification: EvidenceClassification;
	status: VerificationStatus;
	methods: VerificationMethod[];
	details: ClaimVerificationRecord["verificationDetails"];
	scientificContext: ClaimVerificationRecord["scientificContext"];
} {
	const methods: VerificationMethod[] = [
		"methodology-review",
		"primary-source-inspection",
		"benchmark-methodology-audit",
	];
	const hasReproductionArtifact = evidence.some(
		(e) =>
			e.applicableMethods.includes("artifact-reproduction") ||
			e.extractedText.toLowerCase().includes("github.com/") ||
			e.extractedText.toLowerCase().includes("docker") ||
			e.extractedText.toLowerCase().includes("conda") ||
			e.extractedText.toLowerCase().includes("nix"),
	);
	const hasIndependentReplication = evidence.some(
		(e) =>
			e.evidenceRole === "corroborating" && e.sourceId !== input.sourceId,
	);
	const hasMethodology = evidence.some(
		(e) =>
			e.applicableMethods.includes("methodology-review") ||
			e.extractedText.toLowerCase().includes("methodology") ||
			e.extractedText.toLowerCase().includes("experimental setup"),
	);

	// Extract benchmark methodology details
	let warmupRuns = false;
	let batchSize = 0;
	let precision = "unknown";
	let hardwareSpecified = false;
	const confoundersAddressed: string[] = [];

	for (const e of evidence) {
		const text = e.extractedText.toLowerCase();
		if (
			text.includes("warmup") ||
			text.includes("warm-up") ||
			text.includes("warm up")
		)
			warmupRuns = true;
		const batchMatch = text.match(/batch\s*(?:size)?\s*[:=]\s*(\d+)/i);
		if (batchMatch) batchSize = parseInt(batchMatch[1], 10);
		if (
			text.includes("fp32") ||
			text.includes("fp16") ||
			text.includes("bf16") ||
			text.includes("bfloat16") ||
			text.includes("int8") ||
			text.includes("int4")
		) {
			precision =
				text.match(/(fp32|fp16|bfloat16|bf16|int8|int4)/i)?.[1] ||
				"mixed";
		}
		if (
			text.includes("gpu") ||
			text.includes("cpu") ||
			text.includes("tpu") ||
			text.includes("h100") ||
			text.includes("a100")
		) {
			hardwareSpecified = true;
		}
		if (
			text.includes("thermal") ||
			text.includes("throttling") ||
			text.includes("noisy neighbor") ||
			text.includes("confounder")
		) {
			confoundersAddressed.push("thermal/network variance addressed");
		}
	}

	const isVendor = isVendorSource(input.sourceId, input.sourceUrl);
	const isOrigReporting = isOriginalReporting(
		input.sourceId,
		input.sourceUrl,
		evidence,
	);
	// Use the highest evidence tier as sourceTier
	const maxEvidenceTier = Math.max(
		...evidence.map((e) => e.tier || 1),
		1,
	) as EvidenceTier;
	const classification = classifyEvidence(
		evidence,
		input.claimType,
		maxEvidenceTier,
		hasIndependentReplication,
		hasMethodology,
		hasReproductionArtifact,
		isVendor,
		isOrigReporting,
	);

	let status: VerificationStatus = "unverified";
	if (
		classification === "VERIFIED_FACT" ||
		classification === "RESEARCH_FINDING"
	)
		status = "verified";
	else if (classification === "VENDOR_CLAIM") status = "unverified";
	else if (classification === "ORIGINAL_REPORTING") status = "verified";
	else if (classification === "EXPERT_INTERPRETATION")
		status = "partially-verified";
	else status = "unverified";

	const details: ClaimVerificationRecord["verificationDetails"] = {
		methodologyChecked: hasMethodology,
		hardwareSpecified,
		precisionStated: precision !== "unknown",
		batchSizeStated: batchSize > 0,
		warmupExcluded: warmupRuns,
		statisticalRigor: evidence.some(
			(e) =>
				e.extractedText.toLowerCase().includes("confidence interval") ||
				e.extractedText.toLowerCase().includes("p-value") ||
				e.extractedText
					.toLowerCase()
					.includes("statistical significance"),
		),
		confoundersAddressed: confoundersAddressed.length > 0,
		rawDataAvailable: hasReproductionArtifact,
		reproductionArtifact: hasReproductionArtifact
			? evidence.find((e) =>
					e.applicableMethods.includes("artifact-reproduction"),
				)?.url
			: undefined,
		independentReplication: hasIndependentReplication
			? {
					sourceId:
						evidence.find(
							(e) =>
								e.evidenceRole === "corroborating" &&
								e.sourceId !== input.sourceId,
						)?.sourceId || "",
					url:
						evidence.find(
							(e) =>
								e.evidenceRole === "corroborating" &&
								e.sourceId !== input.sourceId,
						)?.url || "",
					confirmed: true,
				}
			: undefined,
	};

	// Look for contradictory findings
	const contradictoryFindings = evidence
		.filter((e) => e.evidenceRole === "counterevidence")
		.map((e) => e.extractedText.slice(0, 200));

	const scientificContext: ClaimVerificationRecord["scientificContext"] = {
		studyDesign: evidence.find(
			(e) =>
				e.extractedText.toLowerCase().includes("study design") ||
				e.extractedText.toLowerCase().includes("experimental design"),
		)?.extractedText,
		methodology: evidence.find((e) =>
			e.applicableMethods.includes("methodology-review"),
		)?.extractedText,
		dataset: evidence.find(
			(e) =>
				e.extractedText.toLowerCase().includes("dataset") ||
				e.extractedText.toLowerCase().includes("data set"),
		)?.extractedText,
		evaluationConditions: evidence.find(
			(e) =>
				e.extractedText.toLowerCase().includes("evaluation") ||
				e.extractedText.toLowerCase().includes("benchmark"),
		)?.extractedText,
		reproducibility: {
			artifactAvailable: hasReproductionArtifact,
			artifactUrl: hasReproductionArtifact
				? evidence.find((e) =>
						e.applicableMethods.includes("artifact-reproduction"),
					)?.url
				: undefined,
			independentReplications: evidence.filter(
				(e) =>
					e.evidenceRole === "corroborating" &&
					e.sourceId !== input.sourceId,
			).length,
			replicationResults: hasIndependentReplication
				? "confirmed"
				: undefined,
		},
		benchmarkMethodology: {
			warmupRuns,
			batchSize,
			precision,
			hardwareSpecified,
			confoundersAddressed,
		},
		contradictoryFindings:
			contradictoryFindings.length > 0
				? contradictoryFindings
				: undefined,
	};

	return { classification, status, methods, details, scientificContext };
}

/** Verify strategic research / advisory claims (Gartner, McKinsey, Forrester, IDC) */
function verifyStrategicResearchClaim(
	input: ClaimVerificationInput,
	evidence: EvidenceReference[],
): {
	classification: EvidenceClassification;
	status: VerificationStatus;
	methods: VerificationMethod[];
	researchContext: ClaimVerificationRecord["researchContext"];
} {
	const methods: VerificationMethod[] = [
		"source-document-review",
		"methodology-review",
		"paywall-accessible-review",
	];
	const advisoryOrgs = [
		"gartner",
		"mckinsey",
		"forrester",
		"idc",
		"technologyreview",
	];
	const isAdvisory = advisoryOrgs.some(
		(org) =>
			input.sourceUrl.toLowerCase().includes(org) ||
			input.sourceId.toLowerCase().includes(org),
	);

	// Extract what we can from accessible evidence
	let methodologyVerifiable = false;
	const accessibleSections: string[] = [];
	const inaccessibleSections: string[] = [];

	for (const e of evidence) {
		const text = e.extractedText.toLowerCase();
		if (
			text.includes("methodology") ||
			text.includes("appendix") ||
			text.includes("survey methodology")
		) {
			methodologyVerifiable = true;
			accessibleSections.push("methodology summary");
		}
		if (
			text.includes("paywall") ||
			text.includes("subscription required") ||
			text.includes("client only") ||
			text.includes("client access") ||
			text.includes("access required") ||
			text.includes("clients only")
		) {
			inaccessibleSections.push(
				text.includes("methodology")
					? "full methodology"
					: "full report",
			);
		} else {
			accessibleSections.push(e.locator);
		}
	}

	// Look for key research integrity elements
	const hasSampleSize = evidence.some((e) => {
		const text = e.extractedText.toLowerCase();
		const mentionsSample =
			text.includes("sample") ||
			text.includes("survey of") ||
			text.includes("respondent") ||
			text.includes("organizations") ||
			text.includes("companies");
		return mentionsSample && /\d/.test(e.extractedText);
	});
	const hasFundingDisclosure = evidence.some(
		(e) =>
			e.extractedText.toLowerCase().includes("funded") ||
			e.extractedText.toLowerCase().includes("sponsored"),
	);
	const hasConflictDisclosure = evidence.some(
		(e) =>
			e.extractedText.toLowerCase().includes("conflict of interest") ||
			e.extractedText.toLowerCase().includes("disclosure"),
	);

	// Research/data collection period and statistical uncertainty
	let researchPeriod: string | undefined;
	const statisticalUncertainty: string[] = [];
	const methodologicalLimitations: string[] = [];
	for (const e of evidence) {
		const text = e.extractedText.toLowerCase();
		if (
			!researchPeriod &&
			(text.includes("between ") ||
				text.includes("from ") ||
				text.includes("to "))
		) {
			const periodMatch = e.extractedText.match(
				/(?:between|from)\s+(\w+\s+\d{4}|\d{4})\s+(?:and|to)\s+(\w+\s+\d{4}|\d{4})/i,
			);
			if (periodMatch)
				researchPeriod = `${periodMatch[1]} to ${periodMatch[2]}`;
		}
		if (
			text.includes("confidence interval") ||
			text.includes("margin of error") ||
			text.includes("statistical uncertainty") ||
			text.includes("standard error")
		) {
			statisticalUncertainty.push(e.extractedText.slice(0, 200));
		}
		if (
			text.includes("limitation") ||
			text.includes("caveat") ||
			text.includes("bias") ||
			text.includes("confound")
		) {
			methodologicalLimitations.push(e.extractedText.slice(0, 200));
		}
	}

	let causalClaimType:
		"correlation" | "causation" | "prediction" | "interpretation" =
		"interpretation";
	for (const e of evidence) {
		const text = e.extractedText.toLowerCase();
		if (
			text.includes("caus") ||
			text.includes("leads to") ||
			text.includes("results in") ||
			text.includes("drives")
		) {
			causalClaimType = "causation";
			break;
		}
		if (
			text.includes("predict") ||
			text.includes("estimate") ||
			text.includes("projected") ||
			text.includes("forecast") ||
			text.includes("potential") ||
			text.includes("could add")
		) {
			causalClaimType = "prediction";
			break;
		}
		if (text.includes("correlat")) {
			causalClaimType = "correlation";
			break;
		}
	}

	const isOrigReporting = isOriginalReporting(
		input.sourceId,
		input.sourceUrl,
		evidence,
	);
	const classification = classifyEvidence(
		evidence,
		input.claimType,
		isAdvisory ? 2 : 1,
		false,
		methodologyVerifiable,
		false,
		false,
		isOrigReporting,
	);

	let status: VerificationStatus = "unverified";
	if (isAdvisory) {
		// Advisory research is typically VENDOR_CLAIM or EXPERT_INTERPRETATION unless methodology is fully accessible
		if (methodologyVerifiable && hasSampleSize) {
			status = "partially-verified";
		} else {
			status = "unverified";
		}
	} else if (classification === "RESEARCH_FINDING") {
		status = "verified";
	} else if (classification === "EXPERT_INTERPRETATION") {
		status = "partially-verified";
	}

	const researchContext: ClaimVerificationRecord["researchContext"] = {
		researchPurpose: evidence.find(
			(e) =>
				e.extractedText.toLowerCase().includes("purpose") ||
				e.extractedText.toLowerCase().includes("objective"),
		)?.extractedText,
		hypotheses: evidence
			.filter((e) => e.extractedText.toLowerCase().includes("hypothesis"))
			.map((e) => e.extractedText.slice(0, 200)),
		researchDesign: evidence.find(
			(e) =>
				e.extractedText.toLowerCase().includes("design") ||
				e.extractedText.toLowerCase().includes("approach"),
		)?.extractedText,
		sampleSize: hasSampleSize
			? parseInt(
					evidence
						.find((e) => e.extractedText.match(/\d+/))
						?.extractedText.match(/\d+/)?.[0] || "0",
					10,
				)
			: undefined,
		sampleComposition: evidence.find(
			(e) =>
				e.extractedText.toLowerCase().includes("sample composition") ||
				e.extractedText.toLowerCase().includes("respondent"),
		)?.extractedText,
		geographicScope: evidence.find(
			(e) =>
				e.extractedText.toLowerCase().includes("geograph") ||
				e.extractedText.toLowerCase().includes("region") ||
				e.extractedText.toLowerCase().includes("country"),
		)?.extractedText,
		industryCoverage: evidence.find(
			(e) =>
				e.extractedText.toLowerCase().includes("industry") ||
				e.extractedText.toLowerCase().includes("sector"),
		)?.extractedText,
		researchPeriod,
		statisticalMethods: evidence
			.filter(
				(e) =>
					e.extractedText.toLowerCase().includes("regression") ||
					e.extractedText.toLowerCase().includes("statistical"),
			)
			.map((e) => e.extractedText.slice(0, 100)),
		statisticalUncertainty:
			statisticalUncertainty.length > 0
				? statisticalUncertainty[0]
				: undefined,
		methodologicalLimitations:
			methodologicalLimitations.length > 0
				? methodologicalLimitations
				: undefined,
		fundingSources: hasFundingDisclosure
			? ([
					evidence.find(
						(e) =>
							e.extractedText.toLowerCase().includes("funded") ||
							e.extractedText.toLowerCase().includes("sponsored"),
					)?.extractedText,
				].filter(Boolean) as string[])
			: undefined,
		conflictsOfInterest: hasConflictDisclosure
			? ([
					evidence.find(
						(e) =>
							e.extractedText
								.toLowerCase()
								.includes("conflict") ||
							e.extractedText
								.toLowerCase()
								.includes("disclosure"),
					)?.extractedText,
				].filter(Boolean) as string[])
			: undefined,
		definitionsUsed: {},
		causalClaimType,
		generalizabilityAssessment: evidence.find(
			(e) =>
				e.extractedText.toLowerCase().includes("generaliz") ||
				e.extractedText.toLowerCase().includes("applicab"),
		)?.extractedText,
		paywallDetails: {
			accessibleSections: [...new Set(accessibleSections)],
			inaccessibleSections: [...new Set(inaccessibleSections)],
			methodologyVerifiable,
		},
	};

	return { classification, status, methods, researchContext };
}

/** Verify enterprise adoption / productivity / ROI claims */
function verifyEnterpriseClaim(
	input: ClaimVerificationInput,
	evidence: EvidenceReference[],
): {
	classification: EvidenceClassification;
	status: VerificationStatus;
	methods: VerificationMethod[];
	enterpriseContext: ClaimVerificationRecord["enterpriseContext"];
} {
	const methods: VerificationMethod[] = [
		"methodology-review",
		"statistical-analysis",
		"cross-reference",
	];

	// Extract enterprise context from evidence
	let measuredOutcome = "";
	let operationalDefinition = "";
	let baseline = "";
	let comparisonGroup = "";
	let individualVsTeamVsOrg:
		"individual" | "team" | "organizational" | "mixed" | "unclear" =
		"unclear";
	let implementationCosts = "";
	let inferenceCosts = "";
	let governanceCosts = "";
	let operatingCosts = "";
	let selectionBias = "";
	let survivorshipBias = "";
	const confoundingVariables: string[] = [];
	let shortTermVsSustained: "short-term" | "sustained" | "unknown" =
		"unknown";
	let realizedVsEstimatedVsProjected:
		"realized" | "estimated" | "projected" | "unknown" = "unknown";
	const organizationalDependencies: string[] = [];
	const technicalDependencies: string[] = [];
	let roi = "";
	let totalCostOfOwnership = "";
	const enterpriseImplications: string[] = [];
	const productivityConsequences: string[] = [];
	const economicImpact: string[] = [];
	const workforceImplications: string[] = [];
	const governanceImplications: string[] = [];

	for (const e of evidence) {
		const text = e.extractedText.toLowerCase();

		// Measured outcome
		if (
			text.includes("productivity") ||
			text.includes("efficiency") ||
			text.includes("speed") ||
			text.includes("throughput") ||
			text.includes("faster") ||
			text.includes("slower") ||
			text.includes("completion time") ||
			text.includes("task completion")
		) {
			measuredOutcome = e.extractedText.slice(0, 200);
		}

		// Operational definition
		if (
			text.includes("defined as") ||
			text.includes("measured by") ||
			text.includes("metric")
		) {
			operationalDefinition = e.extractedText.slice(0, 200);
		}

		// Baseline
		if (
			text.includes("baseline") ||
			text.includes("control group") ||
			text.includes("before")
		) {
			baseline = e.extractedText.slice(0, 200);
		}

		// Comparison group
		if (
			text.includes("compared to") ||
			text.includes("versus") ||
			text.includes("control")
		) {
			comparisonGroup = e.extractedText.slice(0, 200);
		}

		// Level of measurement — individual indicators take precedence: a study of
		// developers/engineers measures individual outcomes even if the experimental
		// arm is labeled a "group".
		if (
			text.includes("individual") ||
			text.includes("per developer") ||
			text.includes("per engineer") ||
			text.includes("developer") ||
			text.includes("engineer")
		) {
			individualVsTeamVsOrg = "individual";
		} else if (
			text.includes("team") ||
			text.includes("group") ||
			text.includes("squad")
		) {
			individualVsTeamVsOrg = "team";
		} else if (
			text.includes("organization") ||
			text.includes("company") ||
			text.includes("enterprise")
		) {
			individualVsTeamVsOrg = "organizational";
		}

		// Costs
		if (
			text.includes("implementation cost") ||
			text.includes("setup cost") ||
			text.includes("onboarding")
		) {
			implementationCosts = e.extractedText.slice(0, 400);
		}
		if (
			text.includes("inference cost") ||
			text.includes("api cost") ||
			text.includes("token cost") ||
			text.includes("compute cost")
		) {
			inferenceCosts = e.extractedText.slice(0, 200);
		}
		if (
			text.includes("governance") ||
			text.includes("compliance") ||
			text.includes("oversight")
		) {
			governanceCosts = e.extractedText.slice(0, 200);
		}
		if (
			text.includes("operating cost") ||
			text.includes("maintenance") ||
			text.includes("ongoing")
		) {
			operatingCosts = e.extractedText.slice(0, 200);
		}

		// Biases
		if (
			text.includes("selection bias") ||
			text.includes("self-selected") ||
			text.includes("volunteer")
		) {
			selectionBias = e.extractedText.slice(0, 200);
		}
		if (text.includes("survivorship") || text.includes("survivor bias")) {
			survivorshipBias = e.extractedText.slice(0, 200);
		}
		if (text.includes("confound") || text.includes("confounding")) {
			confoundingVariables.push(e.extractedText.slice(0, 200));
		}

		// Timeframe
		if (
			text.includes("week") ||
			text.includes("month") ||
			text.includes("quarter")
		) {
			const durationMatch = text.match(/(\d+)\s*(week|month|quarter)/i);
			if (durationMatch) {
				const num = parseInt(durationMatch[1], 10);
				const unit = durationMatch[2].toLowerCase();
				if (
					(unit === "week" && num < 4) ||
					(unit === "month" && num < 3)
				) {
					shortTermVsSustained = "short-term";
				} else {
					shortTermVsSustained = "sustained";
				}
			}
		}

		// Realized vs estimated
		if (
			text.includes("projected") ||
			text.includes("estimated") ||
			text.includes("forecast")
		) {
			realizedVsEstimatedVsProjected = "projected";
		} else if (
			text.includes("achieved") ||
			text.includes("realized") ||
			text.includes("measured")
		) {
			realizedVsEstimatedVsProjected = "realized";
		} else if (realizedVsEstimatedVsProjected === "unknown") {
			realizedVsEstimatedVsProjected = "estimated";
		}

		// Dependencies
		if (
			text.includes("depends on") ||
			text.includes("requires") ||
			text.includes("prerequisite")
		) {
			technicalDependencies.push(e.extractedText.slice(0, 200));
		}
		if (
			text.includes("organizational") ||
			text.includes("culture") ||
			text.includes("process") ||
			text.includes("workflow")
		) {
			organizationalDependencies.push(e.extractedText.slice(0, 200));
		}

		// ROI / TCO
		if (
			!roi &&
			(text.includes("roi") || text.includes("return on investment"))
		) {
			roi = e.extractedText.slice(0, 300);
		}
		if (
			!totalCostOfOwnership &&
			(text.includes("tco") || text.includes("total cost of ownership"))
		) {
			totalCostOfOwnership = e.extractedText.slice(0, 300);
		}

		// Strategic implication categories
		if (
			text.includes("enterprise") ||
			text.includes("adoption") ||
			text.includes("organization")
		) {
			enterpriseImplications.push(e.extractedText.slice(0, 200));
		}
		if (
			text.includes("productivity") ||
			text.includes("delivery") ||
			text.includes("throughput") ||
			text.includes("cycle time")
		) {
			productivityConsequences.push(e.extractedText.slice(0, 200));
		}
		if (
			text.includes("economic") ||
			text.includes("revenue") ||
			text.includes("cost savings") ||
			text.includes("market")
		) {
			economicImpact.push(e.extractedText.slice(0, 200));
		}
		if (
			text.includes("workforce") ||
			text.includes("jobs") ||
			text.includes("roles") ||
			text.includes("skills") ||
			text.includes("hiring")
		) {
			workforceImplications.push(e.extractedText.slice(0, 200));
		}
		if (
			text.includes("governance") ||
			text.includes("compliance") ||
			text.includes("oversight") ||
			text.includes("policy")
		) {
			governanceImplications.push(e.extractedText.slice(0, 200));
		}
	}

	const isVendor = isVendorSource(input.sourceId, input.sourceUrl);
	const isOrigReporting = isOriginalReporting(
		input.sourceId,
		input.sourceUrl,
		evidence,
	);
	const classification = classifyEvidence(
		evidence,
		input.claimType,
		2,
		false,
		true,
		false,
		isVendor,
		isOrigReporting,
	);

	let status: VerificationStatus = "unverified";
	if (
		classification === "VERIFIED_FACT" ||
		classification === "RESEARCH_FINDING"
	)
		status = "verified";
	else if (classification === "VENDOR_CLAIM") status = "unverified";
	else if (classification === "EXPERT_INTERPRETATION")
		status = "partially-verified";
	else if (classification === "INFERENCE") status = "unverified";

	const enterpriseContext: ClaimVerificationRecord["enterpriseContext"] = {
		measuredOutcome: measuredOutcome || undefined,
		operationalDefinition: operationalDefinition || undefined,
		baseline: baseline || undefined,
		comparisonGroup: comparisonGroup || undefined,
		individualVsTeamVsOrg,
		implementationCosts: implementationCosts || undefined,
		inferenceCosts: inferenceCosts || undefined,
		governanceCosts: governanceCosts || undefined,
		operatingCosts: operatingCosts || undefined,
		selectionBias: selectionBias || undefined,
		survivorshipBias: survivorshipBias || undefined,
		confoundingVariables:
			confoundingVariables.length > 0 ? confoundingVariables : undefined,
		shortTermVsSustained,
		realizedVsEstimatedVsProjected,
		organizationalDependencies:
			organizationalDependencies.length > 0
				? organizationalDependencies
				: undefined,
		technicalDependencies:
			technicalDependencies.length > 0
				? technicalDependencies
				: undefined,
		roi: roi || undefined,
		totalCostOfOwnership: totalCostOfOwnership || undefined,
		enterpriseImplications:
			enterpriseImplications.length > 0
				? enterpriseImplications
				: undefined,
		productivityConsequences:
			productivityConsequences.length > 0
				? productivityConsequences
				: undefined,
		economicImpact: economicImpact.length > 0 ? economicImpact : undefined,
		workforceImplications:
			workforceImplications.length > 0
				? workforceImplications
				: undefined,
		governanceImplications:
			governanceImplications.length > 0
				? governanceImplications
				: undefined,
	};

	return { classification, status, methods, enterpriseContext };
}

/** Verify original reporting claims */
function verifyOriginalReportingClaim(
	input: ClaimVerificationInput,
	evidence: EvidenceReference[],
): {
	classification: EvidenceClassification;
	status: VerificationStatus;
	methods: VerificationMethod[];
} {
	const methods: VerificationMethod[] = [
		"primary-source-inspection",
		"cross-reference",
		"source-document-review",
	];

	// Original reporting with first-hand disclosure
	const hasFirstDisclosure = evidence.some(
		(e) => e.timestampType === "first-public-disclosure",
	);
	const hasNamedSources = evidence.some(
		(e) =>
			e.extractedText.toLowerCase().includes("according to") ||
			e.extractedText.toLowerCase().includes("told") ||
			e.extractedText.toLowerCase().includes("said"),
	);
	const hasDocumentation = evidence.some((e) =>
		e.applicableMethods.includes("source-document-review"),
	);

	let classification: EvidenceClassification = "UNVERIFIED";
	// First-hand disclosure of previously unknown information qualifies as original reporting
	// even without formal documentation, per editorial contract on newly revealed facts
	if (hasFirstDisclosure) {
		classification = "ORIGINAL_REPORTING";
	} else if (hasNamedSources && hasDocumentation) {
		classification = "ORIGINAL_REPORTING";
	} else if (hasNamedSources) {
		classification = "EXPERT_INTERPRETATION";
	} else {
		classification = "UNVERIFIED";
	}

	let status: VerificationStatus = "unverified";
	if (classification === "ORIGINAL_REPORTING") status = "verified";
	else if (classification === "EXPERT_INTERPRETATION")
		status = "partially-verified";

	return { classification, status, methods };
}

/** Analyze counterevidence for a claim */
export function analyzeCounterevidence(
	claim: string,
	evidence: EvidenceReference[],
	explicitCounterevidenceOrClaimType: EvidenceReference[] | ClaimType,
	claimTypeMaybe?: ClaimType,
): Counterevidence[] {
	const counterevidence: Counterevidence[] = [];

	// Support both the 4-arg form (explicit counterevidence + claimType) and the
	// legacy 3-arg form (claim, evidence, claimType) for backward compatibility.
	const explicitCounterevidence: EvidenceReference[] = Array.isArray(
		explicitCounterevidenceOrClaimType,
	)
		? explicitCounterevidenceOrClaimType
		: evidence.filter((e) => e.evidenceRole === "counterevidence");

	// Process explicit counterevidence items (evidenceRole === 'counterevidence')
	for (const e of explicitCounterevidence) {
		counterevidence.push({
			id: generateId("ce"),
			claimId: "", // Will be set by caller
			evidenceReference: e,
			contradictsClaim: claim,
			contradictionType: "direct",
			description: `Counterevidence from ${e.sourceId}: ${e.extractedText.slice(0, 200)}`,
			confidence: e.confidence,
			sourceId: e.sourceId,
			discoveredAt: new Date().toISOString(),
		});
	}

	// Also look for implicit contradictions in supporting evidence
	for (const e of evidence) {
		if (
			e.evidenceRole === "primary" ||
			e.evidenceRole === "corroborating"
		) {
			const text = e.extractedText.toLowerCase();
			// Check for qualifying language that actually contradicts/qualifies the claim
			// More specific patterns to avoid false positives on common words like "until", "limited", "early"
			// Also exclude narrative conjunctions like "but" when used in event descriptions
			const qualifyingPatterns = [
				/\bhowever\b/,
				/\balthough\b/,
				/\blimited to\b/,
				/\bpreliminary\b/,
				/\bearly results?\b/,
				/\bcaveat\b/,
				/\bqualif(?:y|ication)\b/,
				/\bwith the exception\b/,
			];
			// Exclude simple narrative conjunctions like "X happened but Y" which don't qualify claims
			const narrativeConjunctions =
				/\b\w+ (?:occurred|happened|was|were) .*?\bbut\b/i;
			const hasNarrativeBut = narrativeConjunctions.test(e.extractedText);
			const hasQualifyingLanguage =
				qualifyingPatterns.some((pattern) => pattern.test(text)) &&
				!hasNarrativeBut;
			if (hasQualifyingLanguage) {
				counterevidence.push({
					id: generateId("ce"),
					claimId: "",
					evidenceReference: e,
					contradictsClaim: claim,
					contradictionType: "qualifying",
					description: `Qualifying language in primary evidence: ${e.extractedText.slice(0, 200)}`,
					confidence: e.confidence * 0.7,
					sourceId: e.sourceId,
					discoveredAt: new Date().toISOString(),
				});
			}
		}
	}

	return counterevidence;
}

/** Identify required assumptions */
export function identifyAssumptions(
	claim: string,
	evidence: EvidenceReference[],
	claimType: ClaimType,
): RequiredAssumption[] {
	const assumptions: RequiredAssumption[] = [];
	const claimLower = claim.toLowerCase();

	// Technical assumptions
	if (
		claimType === "technical-announcement" ||
		claimType === "software-release" ||
		claimType === "benchmark-result" ||
		claimType === "vendor-announcement"
	) {
		if (
			claimLower.includes("faster") ||
			claimLower.includes("speedup") ||
			claimLower.includes("performance")
		) {
			assumptions.push({
				id: generateId("asm"),
				claimId: "",
				assumption:
					"Benchmark conditions (hardware, batch size, precision) are comparable and representative",
				type: "technical",
				criticality: "essential",
				status: "unknown",
			});
		}
		if (
			claimLower.includes("compatible") ||
			claimLower.includes("works with") ||
			claimLower.includes("integrates")
		) {
			assumptions.push({
				id: generateId("asm"),
				claimId: "",
				assumption:
					"API compatibility and version requirements are satisfied in target environment",
				type: "technical",
				criticality: "important",
				status: "unknown",
			});
		}
		// Phased rollout: availability claims apply only to the initial tier
		const evidenceText = evidence
			.map((e) => e.extractedText.toLowerCase())
			.join(" ");
		if (
			evidenceText.includes("rollout") ||
			evidenceText.includes("phased") ||
			evidenceText.includes("over the next") ||
			evidenceText.includes("begins today")
		) {
			assumptions.push({
				id: generateId("asm"),
				claimId: "",
				assumption:
					"Phased rollout means availability claims apply only to the initial tier; general availability across all users is not yet established",
				type: "technical",
				criticality: "important",
				status: "unknown",
			});
		}
	}

	// Methodological assumptions
	if (
		claimType === "scientific-research" ||
		claimType === "benchmark-result"
	) {
		assumptions.push({
			id: generateId("asm"),
			claimId: "",
			assumption:
				"Experimental setup controls for confounding variables (thermal throttling, network variance, noisy neighbors)",
			type: "methodological",
			criticality: "essential",
			status: "unknown",
		});
		assumptions.push({
			id: generateId("asm"),
			claimId: "",
			assumption:
				"Statistical methods are appropriate and sample sizes are sufficient",
			type: "methodological",
			criticality: "essential",
			status: "unknown",
		});
	}

	// Strategic research assumptions
	if (
		claimType === "strategic-research" ||
		claimType === "advisory-finding"
	) {
		assumptions.push({
			id: generateId("asm"),
			claimId: "",
			assumption:
				"Survey sample is representative of the target population",
			type: "methodological",
			criticality: "essential",
			status: "unknown",
		});
		assumptions.push({
			id: generateId("asm"),
			claimId: "",
			assumption:
				"Self-reported data accurately reflects actual behavior/outcomes",
			type: "methodological",
			criticality: "important",
			status: "unknown",
		});
		assumptions.push({
			id: generateId("asm"),
			claimId: "",
			assumption:
				"Correlation implies causation (if causal claim is made)",
			type: "methodological",
			criticality: "essential",
			status: "unknown",
		});
		assumptions.push({
			id: generateId("asm"),
			claimId: "",
			assumption:
				"Economic impact estimates depend on adoption curves and productivity modeling choices",
			type: "methodological",
			criticality: "essential",
			status: "unknown",
		});
	}

	// Enterprise assumptions
	if (
		claimType === "enterprise-adoption" ||
		claimType === "productivity-claim" ||
		claimType === "roi-claim"
	) {
		assumptions.push({
			id: generateId("asm"),
			claimId: "",
			assumption:
				"Measured productivity gains translate to organizational outcomes",
			type: "organizational",
			criticality: "essential",
			status: "unknown",
		});
		assumptions.push({
			id: generateId("asm"),
			claimId: "",
			assumption:
				"Implementation, inference, and governance costs are accounted for in ROI",
			type: "economic",
			criticality: "important",
			status: "unknown",
		});
		assumptions.push({
			id: generateId("asm"),
			claimId: "",
			assumption:
				"Selection bias and survivorship bias do not materially affect results",
			type: "methodological",
			criticality: "important",
			status: "unknown",
		});
	}

	return assumptions;
}

/** Identify alternative explanations */
export function identifyAlternativeExplanations(
	claim: string,
	evidence: EvidenceReference[],
	claimType: ClaimType,
): AlternativeExplanation[] {
	const alternatives: AlternativeExplanation[] = [];
	const claimLower = claim.toLowerCase();

	// Confounding variable alternatives
	if (
		claimLower.includes("improves") ||
		claimLower.includes("increases") ||
		claimLower.includes("boosts") ||
		claimLower.includes("reduces") ||
		claimLower.includes("decreases") ||
		claimLower.includes("faster")
	) {
		alternatives.push({
			id: generateId("alt"),
			claimId: "",
			explanation:
				"Observed effect may be due to confounding variables (e.g., Hawthorne effect, selection bias, concurrent changes) rather than the claimed cause",
			type: "confounding-variable",
			plausibility: "medium",
		});
	}

	// Selection bias
	if (
		claimType === "enterprise-adoption" ||
		claimType === "productivity-claim" ||
		claimType === "roi-claim"
	) {
		alternatives.push({
			id: generateId("alt"),
			claimId: "",
			explanation:
				"Participants may be self-selected early adopters with higher baseline capability, inflating apparent benefits",
			type: "selection-bias",
			plausibility: "high",
		});
		alternatives.push({
			id: generateId("alt"),
			claimId: "",
			explanation:
				"Survivorship bias: only successful implementations are reported; failed attempts are not visible",
			type: "selection-bias",
			plausibility: "medium",
		});
	}

	// Measurement artifact
	if (
		claimType === "benchmark-result" ||
		claimType === "technical-announcement"
	) {
		alternatives.push({
			id: generateId("alt"),
			claimId: "",
			explanation:
				"Benchmark may measure proxy metrics that do not reflect real-world performance",
			type: "measurement-artifact",
			plausibility: "medium",
		});
	}

	// Different causal mechanism
	if (
		claimType === "strategic-research" ||
		claimType === "advisory-finding"
	) {
		alternatives.push({
			id: generateId("alt"),
			claimId: "",
			explanation:
				"Correlation may reflect a third variable driving both observed factors, not direct causation",
			type: "different-causal-mechanism",
			plausibility: "medium",
		});
	}

	// Statistical fluke
	alternatives.push({
		id: generateId("alt"),
		claimId: "",
		explanation:
			"Result may be a statistical fluke (Type I error), especially if not replicated independently",
		type: "statistical-fluke",
		plausibility: "low",
	});

	return alternatives;
}

/** Identify falsification criteria */
export function identifyFalsificationCriteria(
	claim: string,
	evidence: EvidenceReference[],
	claimType: ClaimType,
): FalsificationCriterion[] {
	const criteria: FalsificationCriterion[] = [];

	// Universal: independent replication
	criteria.push({
		id: generateId("fal"),
		claimId: "",
		criterion:
			"Independent replication of the claimed result under same conditions fails to reproduce the finding; independent reproduction attempt yields significantly different results",
		type: "reproduction",
		feasibility: "feasible",
		estimatedCost: "medium",
		timeframe: "1-3 months",
		prerequisites: [
			"Access to same hardware/environment",
			"Reproduction artifact (code, data, config)",
		],
	});

	// Type-specific falsification
	if (
		claimType === "technical-announcement" ||
		claimType === "software-release"
	) {
		criteria.push({
			id: generateId("fal"),
			claimId: "",
			criterion:
				"Feature does not work as documented when tested against public API",
			type: "observation",
			feasibility: "feasible",
			estimatedCost: "low",
			timeframe: "1-2 weeks",
			prerequisites: [
				"Access to the product/feature",
				"Test environment",
			],
		});
	}

	if (claimType === "benchmark-result") {
		criteria.push({
			id: generateId("fal"),
			claimId: "",
			criterion:
				"Benchmark run with controlled confounders (thermal, network) shows significantly different results",
			type: "experiment",
			feasibility: "feasible",
			estimatedCost: "medium",
			timeframe: "2-4 weeks",
			prerequisites: [
				"Controlled benchmark environment",
				"Same hardware specification",
			],
		});
	}

	if (
		claimType === "enterprise-adoption" ||
		claimType === "productivity-claim" ||
		claimType === "roi-claim"
	) {
		criteria.push({
			id: generateId("fal"),
			claimId: "",
			criterion:
				"Controlled A/B test with randomized assignment shows no significant difference",
			type: "experiment",
			feasibility: "difficult",
			estimatedCost: "high",
			timeframe: "3-6 months",
			prerequisites: [
				"Organizational cooperation",
				"Randomized trial design",
				"Sufficient sample size",
			],
		});
	}

	if (
		claimType === "strategic-research" ||
		claimType === "advisory-finding"
	) {
		criteria.push({
			id: generateId("fal"),
			claimId: "",
			criterion:
				"Methodological audit reveals fatal flaws in study design, sampling, or statistical analysis",
			type: "audit",
			feasibility: "feasible",
			estimatedCost: "low",
			timeframe: "2-4 weeks",
			prerequisites: [
				"Full methodology documentation",
				"Access to raw data (if available)",
			],
		});
	}

	return criteria;
}

/** Identify unresolved uncertainties */
export function identifyUnresolvedUncertainties(
	claim: string,
	evidence: EvidenceReference[],
	counterevidence: Counterevidence[],
	claimType: ClaimType,
): UnresolvedUncertainty[] {
	const uncertainties: UnresolvedUncertainty[] = [];

	// Evidence gaps
	if (evidence.filter((e) => e.evidenceRole === "primary").length === 0) {
		uncertainties.push({
			id: generateId("unc"),
			claimId: "",
			uncertainty:
				"No primary evidence directly supporting the claim; all evidence is secondary or corroborating",
			type: "evidence-gap",
			impact: "high",
			blockingVerification: true,
			researchNeeded: "Locate and verify primary source documentation",
		});
	}

	if (evidence.length === 0) {
		uncertainties.push({
			id: generateId("unc"),
			claimId: "",
			uncertainty: "No evidence available for this claim",
			type: "evidence-gap",
			impact: "high",
			blockingVerification: true,
			researchNeeded: "Find any supporting documentation or source",
		});
	}

	// Methodological uncertainties
	if (
		claimType === "scientific-research" ||
		claimType === "benchmark-result"
	) {
		const hasMethodology = evidence.some((e) =>
			e.applicableMethods.includes("methodology-review"),
		);
		if (!hasMethodology) {
			uncertainties.push({
				id: generateId("unc"),
				claimId: "",
				uncertainty:
					"Methodology not documented or accessible for review",
				type: "methodological",
				impact: "high",
				blockingVerification: true,
				researchNeeded:
					"Obtain full methodology documentation; request from authors if paywalled",
			});
		}
	}

	// Counterevidence uncertainty
	if (counterevidence.length > 0) {
		uncertainties.push({
			id: generateId("unc"),
			claimId: "",
			uncertainty: `${counterevidence.length} piece(s) of counterevidence identified; claim may be contradicted or qualified`,
			type: "evidence-gap",
			impact: "high",
			blockingVerification: true,
			researchNeeded:
				"Investigate counterevidence sources; determine if they invalidate or merely qualify the claim",
		});
	}

	// Temporal uncertainty
	const hasExactTimestamp = evidence.some(
		(e) => e.timestampType === "original-publication" && e.confidence > 0.9,
	);
	if (!hasExactTimestamp) {
		uncertainties.push({
			id: generateId("unc"),
			claimId: "",
			uncertainty:
				"Exact publication/disclosure timestamp cannot be verified with high confidence",
			type: "temporal",
			impact: "medium",
			blockingVerification: false,
			researchNeeded:
				"Verify publication timestamp via archive snapshots, version history, or author confirmation",
		});
	}

	// Generalizability
	if (
		claimType === "enterprise-adoption" ||
		claimType === "productivity-claim" ||
		claimType === "strategic-research"
	) {
		uncertainties.push({
			id: generateId("unc"),
			claimId: "",
			uncertainty:
				"Results may not generalize to other organizations, industries, or technical contexts",
			type: "generalizability",
			impact: "medium",
			blockingVerification: false,
			researchNeeded:
				"Identify boundary conditions; test in different organizational/technical contexts",
		});
	}

	// Scope uncertainty
	const claimLower = claim.toLowerCase();
	if (
		claimLower.includes("all") ||
		claimLower.includes("every") ||
		claimLower.includes("universal") ||
		claimLower.includes("always")
	) {
		uncertainties.push({
			id: generateId("unc"),
			claimId: "",
			uncertainty:
				'Claim uses universal quantifier ("all", "every", "always") but evidence may only support limited scope',
			type: "scope",
			impact: "high",
			blockingVerification: true,
			researchNeeded:
				"Determine actual scope of evidence; qualify claim to match evidence",
		});
	}

	return uncertainties;
}

/** Main verification function */
export async function verifyClaim(
	input: ClaimVerificationInput,
): Promise<ClaimVerificationRecord> {
	const startTime = Date.now();
	const verifiedAt = new Date().toISOString();

	// Build evidence references with IDs and retrieval metadata
	const supportingEvidence: EvidenceReference[] =
		input.supportingEvidence.map((e, i) => ({
			...e,
			id: generateId("ev"),
			retrievalMetadata: {
				retrievedAt: new Date().toISOString(),
				retrievalMethod: "automated-collection",
				contentHash: `sha256:${crypto.createHash("sha256").update(e.extractedText).digest("hex")}`,
			},
		}));

	// Sort evidence by role priority: primary > corroborating > secondary > counterevidence
	const rolePriority = {
		primary: 0,
		corroborating: 1,
		secondary: 2,
		counterevidence: 3,
	};
	supportingEvidence.sort(
		(a, b) => rolePriority[a.evidenceRole] - rolePriority[b.evidenceRole],
	);

	// Separate counterevidence
	const counterevidenceItems = supportingEvidence.filter(
		(e) => e.evidenceRole === "counterevidence",
	);
	const primaryEvidence = supportingEvidence.filter(
		(e) => e.evidenceRole !== "counterevidence",
	);

	// Determine claim type and route to specialized verification
	let classification: EvidenceClassification;
	let status: VerificationStatus;
	let methods: VerificationMethod[] = [];
	let details: ClaimVerificationRecord["verificationDetails"] | undefined;
	let productContext: ClaimVerificationRecord["productContext"] | undefined;
	let technicalContext:
		ClaimVerificationRecord["technicalContext"] | undefined;
	let scientificContext:
		ClaimVerificationRecord["scientificContext"] | undefined;
	let researchContext: ClaimVerificationRecord["researchContext"] | undefined;
	let enterpriseContext:
		ClaimVerificationRecord["enterpriseContext"] | undefined;

	switch (input.claimType) {
		case "technical-announcement":
		case "software-release":
		case "vendor-announcement": {
			const result = verifyTechnicalClaim(input, primaryEvidence);
			classification = result.classification;
			status = result.status;
			methods = result.methods;
			details = result.details;
			technicalContext = result.technicalContext;
			productContext = result.productContext;
			break;
		}
		case "scientific-research":
		case "benchmark-result": {
			const result = verifyScientificClaim(input, primaryEvidence);
			classification = result.classification;
			status = result.status;
			methods = result.methods;
			details = result.details;
			scientificContext = result.scientificContext;
			break;
		}
		case "strategic-research":
		case "advisory-finding": {
			const result = verifyStrategicResearchClaim(input, primaryEvidence);
			classification = result.classification;
			status = result.status;
			methods = result.methods;
			researchContext = result.researchContext;
			break;
		}
		case "enterprise-adoption":
		case "productivity-claim":
		case "roi-claim":
		case "economic-impact": {
			const result = verifyEnterpriseClaim(input, primaryEvidence);
			classification = result.classification;
			status = result.status;
			methods = result.methods;
			enterpriseContext = result.enterpriseContext;
			break;
		}
		case "original-reporting": {
			const result = verifyOriginalReportingClaim(input, primaryEvidence);
			classification = result.classification;
			status = result.status;
			methods = result.methods;
			break;
		}
		default: {
			// Generic verification
			const isVendor = isVendorSource(input.sourceId, input.sourceUrl);
			const isOrigReporting = isOriginalReporting(
				input.sourceId,
				input.sourceUrl,
				primaryEvidence,
			);
			const hasIndependentReplication = primaryEvidence.some(
				(e) =>
					e.evidenceRole === "corroborating" &&
					e.sourceId !== input.sourceId,
			);
			const hasMethodology = primaryEvidence.some((e) =>
				e.applicableMethods.includes("methodology-review"),
			);
			const hasReproductionArtifact = primaryEvidence.some((e) =>
				e.applicableMethods.includes("artifact-reproduction"),
			);

			classification = classifyEvidence(
				primaryEvidence,
				input.claimType,
				2,
				hasIndependentReplication,
				hasMethodology,
				hasReproductionArtifact,
				isVendor,
				isOrigReporting,
			);

			if (
				classification === "VERIFIED_FACT" ||
				classification === "RESEARCH_FINDING" ||
				classification === "ORIGINAL_REPORTING"
			) {
				status = "verified";
			} else if (
				classification === "VENDOR_CLAIM" ||
				classification === "SPECULATION" ||
				classification === "UNVERIFIED"
			) {
				status = "unverified";
			} else {
				status = "partially-verified";
			}
			methods = ["primary-source-inspection", "cross-reference"];
		}
	}

	// Add common methods
	if (!methods.includes("primary-source-inspection"))
		methods.push("primary-source-inspection");
	if (!methods.includes("cross-reference")) methods.push("cross-reference");

	// Analyze counterevidence
	const counterevidence = analyzeCounterevidence(
		input.claim,
		primaryEvidence,
		counterevidenceItems,
		input.claimType,
	);
	counterevidence.forEach((ce) => {
		ce.claimId = generateId("claim");
	});

	// Identify assumptions
	const assumptions = identifyAssumptions(
		input.claim,
		primaryEvidence,
		input.claimType,
	);
	assumptions.forEach((a) => {
		a.claimId = generateId("claim");
	});

	// Identify alternative explanations
	const alternativeExplanations = identifyAlternativeExplanations(
		input.claim,
		primaryEvidence,
		input.claimType,
	);
	alternativeExplanations.forEach((a) => {
		a.claimId = generateId("claim");
	});

	// Identify falsification criteria
	const falsificationCriteria = identifyFalsificationCriteria(
		input.claim,
		primaryEvidence,
		input.claimType,
	);
	falsificationCriteria.forEach((f) => {
		f.claimId = generateId("claim");
	});

	// Identify unresolved uncertainties
	const unresolvedUncertainties = identifyUnresolvedUncertainties(
		input.claim,
		primaryEvidence,
		counterevidence,
		input.claimType,
	);
	unresolvedUncertainties.forEach((u) => {
		u.claimId = generateId("claim");
	});

	// Determine verification level
	let verificationLevel: "L0" | "L1" | "L2" | "L3" = "L0";
	// Vendor claims, speculation and unverified assertions cannot claim methodology
	// verification (L1+) — that requires independent scrutiny.
	if (
		classification === "VENDOR_CLAIM" ||
		classification === "UNVERIFIED" ||
		classification === "SPECULATION"
	) {
		verificationLevel = "L0";
	} else if (details) {
		const checks = [
			details.methodologyChecked,
			details.hardwareSpecified,
			details.precisionStated,
			details.batchSizeStated,
			details.warmupExcluded,
			details.statisticalRigor,
			details.confoundersAddressed,
			details.rawDataAvailable,
		].filter(Boolean).length;

		if (checks >= 6 && details.independentReplication?.confirmed) {
			verificationLevel = "L3";
		} else if (checks >= 4 && details.rawDataAvailable) {
			verificationLevel = "L2";
		} else if (details.methodologyChecked) {
			verificationLevel = "L1";
		}
	} else if (methods.includes("methodology-review")) {
		verificationLevel = "L1";
	}

	// Adjust status based on counterevidence
	if (counterevidence.length > 0) {
		const hasDirectCounterevidence = counterevidence.some(
			(ce) => ce.contradictionType === "direct",
		);
		if (hasDirectCounterevidence) {
			// Direct counterevidence contradicts the claim regardless of base status
			status = "contradicted";
		} else if (status === "verified") {
			status = "contradicted";
		} else if (status === "partially-verified") {
			status = "insufficient-evidence";
		}
	}

	// Calculate confidence
	const confidence = calculateConfidence(
		primaryEvidence,
		counterevidence,
		classification,
		verificationLevel,
	);

	// Temporal verification
	const originalPublicationTimestamp = input.publicationTimestamp;
	const firstPublicDisclosureTimestamp =
		input.firstDisclosureTimestamp ||
		primaryEvidence.find(
			(e) => e.timestampType === "first-public-disclosure",
		)?.timestamp;
	const underlyingEventTimestamp = primaryEvidence.find(
		(e) => e.timestampType === "underlying-event",
	)?.timestamp;
	const substantiveUpdateTimestamp = primaryEvidence.find(
		(e) => e.timestampType === "substantive-update",
	)?.timestamp;
	const retrievalTimestamp = new Date().toISOString();
	const indexingTimestamp = new Date().toISOString();

	// Determine timezone precision
	let timezonePrecision: "exact" | "source-stated" | "inferred" | "unknown" =
		"unknown";
	const pubTs = primaryEvidence.find(
		(e) => e.timestampType === "original-publication",
	);
	if (pubTs) {
		if (pubTs.sourceTimezone && pubTs.confidence > 0.9)
			timezonePrecision = "exact";
		else if (pubTs.sourceTimezone) timezonePrecision = "source-stated";
		else timezonePrecision = "inferred";
	}

	const timestampConfidence = pubTs?.confidence || 0.5;

	const claimId = generateId("claim");

	// Build final record
	const record: ClaimVerificationRecord = {
		id: claimId,
		candidateId: input.candidateId,
		candidateStableId: input.candidateStableId,
		claim: input.claim,
		claimType: input.claimType,
		originalSource: {
			sourceId: input.sourceId,
			url: input.sourceUrl,
			title: input.sourceTitle,
			author: input.sourceAuthor,
			publisher: input.sourcePublisher,
			publicationTimestamp: input.publicationTimestamp,
			firstDisclosureTimestamp: input.firstDisclosureTimestamp,
		},
		supportingEvidence: primaryEvidence,
		counterevidence,
		assumptions,
		alternativeExplanations,
		falsificationCriteria,
		unresolvedUncertainties,
		evidenceClassification: classification,
		verificationStatus: status,
		verificationMethods: methods,
		confidence,
		verificationLevel,
		verificationDetails: details,
		temporalVerification: {
			originalPublicationTimestamp,
			firstPublicDisclosureTimestamp,
			underlyingEventTimestamp,
			substantiveUpdateTimestamp,
			retrievalTimestamp,
			indexingTimestamp,
			timezonePrecision,
			timestampConfidence,
		},
		productContext,
		technicalContext,
		scientificContext,
		researchContext,
		enterpriseContext,
		verifiedAt,
		verifiedBy: "evidence-verification-engine",
		verificationDurationMs: Date.now() - startTime,
		revisionHistory: [],
	};

	// Set claimId on all related records
	record.counterevidence.forEach((ce) => {
		ce.claimId = claimId;
	});
	record.assumptions.forEach((a) => {
		a.claimId = claimId;
	});
	record.alternativeExplanations.forEach((a) => {
		a.claimId = claimId;
	});
	record.falsificationCriteria.forEach((f) => {
		f.claimId = claimId;
	});
	record.unresolvedUncertainties.forEach((u) => {
		u.claimId = claimId;
	});

	return record;
}

/** Batch verify multiple claims */
export async function verifyClaims(
	input:
		| {
				editionDate: string;
				editionContext?: Record<string, unknown>;
				cliOptions?: Record<string, unknown>;
				llmClient?: unknown;
				candidates?: unknown[];
				items?: unknown[];
		  }
		| unknown[],
): Promise<ClaimVerificationRecord[]> {
	// Handle both array input (direct) and object input (from workflow engine)
	const items = Array.isArray(input)
		? input
		: input.candidates || input["candidates"] || input.items || [];
	const results: ClaimVerificationRecord[] = [];
	for (const inputItem of items) {
		results.push(await verifyClaim(inputItem as ClaimVerificationInput));
	}
	return results;
}

/** Get verification statistics */
export function getVerificationStats(records: ClaimVerificationRecord[]): {
	totalClaims: number;
	byClassification: Record<EvidenceClassification, number>;
	byStatus: Record<VerificationStatus, number>;
	byLevel: Record<"L0" | "L1" | "L2" | "L3", number>;
	byClaimType: Record<ClaimType, number>;
	averageConfidence: number;
	claimsWithCounterevidence: number;
	claimsWithUnresolvedUncertainties: number;
	verificationCoveragePercent: number;
} {
	const stats = {
		totalClaims: records.length,
		byClassification: {} as Record<EvidenceClassification, number>,
		byStatus: {} as Record<VerificationStatus, number>,
		byLevel: { L0: 0, L1: 0, L2: 0, L3: 0 },
		byClaimType: {} as Record<ClaimType, number>,
		averageConfidence: 0,
		claimsWithCounterevidence: 0,
		claimsWithUnresolvedUncertainties: 0,
		verificationCoveragePercent: 0,
	};

	// Initialize classification and status counts
	const classifications: EvidenceClassification[] = [
		"VERIFIED_FACT",
		"VENDOR_CLAIM",
		"RESEARCH_FINDING",
		"ORIGINAL_REPORTING",
		"EXPERT_INTERPRETATION",
		"INFERENCE",
		"SPECULATION",
		"UNVERIFIED",
	];
	const statuses: VerificationStatus[] = [
		"verified",
		"partially-verified",
		"unverified",
		"contradicted",
		"insufficient-evidence",
		"downgraded",
		"retracted",
	];
	const claimTypes: ClaimType[] = [
		"technical-announcement",
		"software-release",
		"scientific-research",
		"benchmark-result",
		"strategic-research",
		"advisory-finding",
		"enterprise-adoption",
		"productivity-claim",
		"roi-claim",
		"economic-impact",
		"original-reporting",
		"vendor-announcement",
		"policy-regulation",
		"security-vulnerability",
	];

	for (const c of classifications) stats.byClassification[c] = 0;
	for (const s of statuses) stats.byStatus[s] = 0;
	for (const t of claimTypes) stats.byClaimType[t] = 0;

	let confidenceSum = 0;
	let verifiedOrPartial = 0;

	for (const record of records) {
		stats.byClassification[record.evidenceClassification]++;
		stats.byStatus[record.verificationStatus]++;
		stats.byLevel[record.verificationLevel]++;
		stats.byClaimType[record.claimType]++;
		confidenceSum += record.confidence;

		if (
			record.verificationStatus === "verified" ||
			record.verificationStatus === "partially-verified"
		) {
			verifiedOrPartial++;
		}
		if (record.counterevidence.length > 0) {
			stats.claimsWithCounterevidence++;
		}
		if (record.unresolvedUncertainties.length > 0) {
			stats.claimsWithUnresolvedUncertainties++;
		}
	}

	stats.averageConfidence =
		records.length > 0 ? confidenceSum / records.length : 0;
	stats.verificationCoveragePercent =
		records.length > 0 ? (verifiedOrPartial / records.length) * 100 : 0;

	return stats;
}
