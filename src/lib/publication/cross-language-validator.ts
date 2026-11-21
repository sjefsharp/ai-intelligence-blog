/**
 * Cross-Language Consistency Validator
 *
 * Implements structured relationships and deterministic checks establishing
 * whether every materially selected development appears in both Dutch and
 * English representations, preserving factual provenance across all
 * representations.
 */

import { createHash } from "node:crypto";
import type {
	CanonicalFactDossier,
	ConsolidatedClaim,
} from "../fact-dossier/schema.js";
import type { EditorialSelectionManifest } from "../editorial-selection/schema.js";

/**
 * Cross-language claim mapping entry
 */
export interface CrossLanguageClaimMapping {
	claimId: string;
	candidateId: string;
	storyId: string;
	dutchPublication: {
		artifactId: string;
		contentHash: string;
		passageRefs: PassageReference[];
	};
	englishPublication: {
		artifactId: string;
		contentHash: string;
		passageRefs: PassageReference[];
	};
	englishListening: {
		artifactId: string;
		contentHash: string;
		passageRefs: PassageReference[];
	};
	dutchListening: {
		artifactId: string;
		contentHash: string;
		passageRefs: PassageReference[];
	};
	consistencyStatus:
		| "consistent"
		| "missing-english-article"
		| "missing-english-listening"
		| "missing-dutch"
		| "divergent";
	divergenceDetails: DivergenceDetail[];
}

/**
 * Passage reference for traceability
 */
export interface PassageReference {
	characterOffset: number;
	lineNumber: number;
	sectionHeading: string | undefined;
	quote: string;
}

/**
 * Divergence detail
 */
export interface DivergenceDetail {
	type:
		| "numerical-difference"
		| "date-difference"
		| "version-difference"
		| "maturity-difference"
		| "certainty-difference"
		| "attribution-difference"
		| "missing-limitation"
		| "missing-development"
		| "additional-claim";
	description: string;
	dutchValue: string;
	englishValue: string;
	severity: "critical" | "major" | "minor" | "advisory";
	evidence: string[];
}

/**
 * Cross-language validation result
 */
export interface CrossLanguageValidationResult {
	editionDate: string;
	editionId: string;
	factDossierId: string;
	editorialManifestId: string;
	totalSelectedStories: number;
	claimMappings: CrossLanguageClaimMapping[];
	summary: {
		consistentClaims: number;
		divergentClaims: number;
		missingEnglishArticle: number;
		missingEnglishListening: number;
		missingDutch: number;
		criticalDivergences: number;
		majorDivergences: number;
	};
	overallStatus: "consistent" | "divergences-found" | "incomplete";
	validationTimestamp: string;
	contentHash: string;
}

/**
 * Options for cross-language validation
 */
export interface CrossLanguageValidationOptions {
	dutchNewsletterMarkdown: string;
	dutchNewsletterArtifactId: string;
	dutchNewsletterTraceability: {
		segments: Array<{
			type: string;
			claimIds: string[];
			sourceIds: string[];
			storyId?: string;
		}>;
		claimCoverage: string[];
		sourceCoverage: string[];
		storyCoverage: string[];
	};
	dutchListeningMarkdown: string;
	dutchListeningArtifactId: string;
	dutchListeningTraceability: {
		segments: Array<{
			type: string;
			claimIds: string[];
			sourceIds: string[];
			storyId?: string;
		}>;
		claimCoverage: string[];
		sourceCoverage: string[];
		storyCoverage: string[];
	};
	englishArticleMarkdown: string;
	englishArticleArtifactId: string;
	englishArticleTraceability: {
		segments: Array<{
			type: string;
			claimIds: string[];
			sourceIds: string[];
			storyId?: string;
		}>;
		claimCoverage: string[];
		sourceCoverage: string[];
		storyCoverage: string[];
	};
	englishListeningMarkdown: string;
	englishListeningArtifactId: string;
	englishListeningTraceability: {
		segments: Array<{
			type: string;
			claimIds: string[];
			sourceIds: string[];
			storyId?: string;
		}>;
		claimCoverage: string[];
		sourceCoverage: string[];
		storyCoverage: string[];
	};
}

/**
 * Validate cross-language consistency
 */
export async function validateCrossLanguageConsistency(
	options: CrossLanguageValidationOptions,
	factDossier: CanonicalFactDossier,
	editorialManifest: EditorialSelectionManifest,
): Promise<CrossLanguageValidationResult> {
	const {
		dutchNewsletterMarkdown,
		dutchNewsletterArtifactId,
		dutchListeningMarkdown,
		dutchListeningArtifactId,
		englishArticleMarkdown,
		englishArticleArtifactId,
		englishListeningMarkdown,
		englishListeningArtifactId,
	} = options;

	// Get selected stories from editorial manifest
	const selectedStories = editorialManifest.stories.filter(
		(s) => s.decision === "SELECTED" || s.decision === "CATCH_UP_SELECTED",
	);

	const claimMappings: CrossLanguageClaimMapping[] = [];

	// Build claim-to-story mapping from editorial manifest
	const claimToStoryMap = new Map<string, string>();
	for (const story of selectedStories) {
		for (const claimId of story.claimIds) {
			claimToStoryMap.set(claimId, story.storyId);
		}
	}

	// Build claim-to-candidate mapping from fact dossier
	const claimToCandidateMap = new Map<string, string>();
	for (const candidate of factDossier.candidates) {
		for (const claim of candidate.claims) {
			claimToCandidateMap.set(claim.claimId, candidate.candidateId);
		}
	}

	// Get all claim IDs from selected stories
	const allSelectedClaimIds = selectedStories.flatMap((s) => s.claimIds);

	// For each claim, check presence and consistency across all four representations
	for (const claimId of allSelectedClaimIds) {
		const storyId = claimToStoryMap.get(claimId) ?? "unknown";
		const candidateId = claimToCandidateMap.get(claimId) ?? "unknown";

		// Find passage references in each representation
		const dutchNewsletterRefs = findPassageReferencesForClaim(
			dutchNewsletterMarkdown,
			claimId,
		);
		const dutchListeningRefs = findPassageReferencesForClaim(
			dutchListeningMarkdown,
			claimId,
		);
		const englishArticleRefs = findPassageReferencesForClaim(
			englishArticleMarkdown,
			claimId,
		);
		const englishListeningRefs = findPassageReferencesForClaim(
			englishListeningMarkdown,
			claimId,
		);

		// Check if claim is mentioned in each representation
		const inDutchNewsletter = dutchNewsletterRefs.length > 0;
		const inDutchListening = dutchListeningRefs.length > 0;
		const inEnglishArticle = englishArticleRefs.length > 0;
		const inEnglishListening = englishListeningRefs.length > 0;

		// Check for divergences
		const divergences = await detectDivergences(
			claimId,
			dutchNewsletterMarkdown,
			dutchListeningMarkdown,
			englishArticleMarkdown,
			englishListeningMarkdown,
			dutchNewsletterRefs,
			dutchListeningRefs,
			englishArticleRefs,
			englishListeningRefs,
			factDossier,
		);

		// Determine consistency status
		let consistencyStatus: CrossLanguageClaimMapping["consistencyStatus"] =
			"consistent";
		if (!inEnglishArticle && !inEnglishListening) {
			consistencyStatus = "missing-english-article"; // or missing-english-listening
		} else if (!inEnglishArticle) {
			consistencyStatus = "missing-english-article";
		} else if (!inEnglishListening) {
			consistencyStatus = "missing-english-listening";
		} else if (!inDutchNewsletter && !inDutchListening) {
			consistencyStatus = "missing-dutch";
		} else if (divergences.length > 0) {
			consistencyStatus = "divergent";
		}

		claimMappings.push({
			claimId,
			candidateId,
			storyId,
			dutchPublication: {
				artifactId: dutchNewsletterArtifactId,
				contentHash: computeContentHash(dutchNewsletterMarkdown),
				passageRefs: dutchNewsletterRefs,
			},
			englishPublication: {
				artifactId: englishArticleArtifactId,
				contentHash: computeContentHash(englishArticleMarkdown),
				passageRefs: englishArticleRefs,
			},
			englishListening: {
				artifactId: englishListeningArtifactId,
				contentHash: computeContentHash(englishListeningMarkdown),
				passageRefs: englishListeningRefs,
			},
			dutchListening: {
				artifactId: dutchListeningArtifactId,
				contentHash: computeContentHash(dutchListeningMarkdown),
				passageRefs: dutchListeningRefs,
			},
			consistencyStatus,
			divergenceDetails: divergences,
		});
	}

	// Compute summary
	const consistentClaims = claimMappings.filter(
		(m) => m.consistencyStatus === "consistent",
	).length;
	const divergentClaims = claimMappings.filter(
		(m) => m.consistencyStatus === "divergent",
	).length;
	const missingEnglishArticle = claimMappings.filter(
		(m) => m.consistencyStatus === "missing-english-article",
	).length;
	const missingEnglishListening = claimMappings.filter(
		(m) => m.consistencyStatus === "missing-english-listening",
	).length;
	const missingDutch = claimMappings.filter(
		(m) => m.consistencyStatus === "missing-dutch",
	).length;
	const criticalDivergences = claimMappings.flatMap((m) =>
		m.divergenceDetails.filter((d) => d.severity === "critical"),
	).length;
	const majorDivergences = claimMappings.flatMap((m) =>
		m.divergenceDetails.filter((d) => d.severity === "major"),
	).length;

	let overallStatus: CrossLanguageValidationResult["overallStatus"] =
		"consistent";
	if (divergentClaims > 0) {
		overallStatus = "divergences-found";
	} else if (
		missingEnglishArticle > 0 ||
		missingEnglishListening > 0 ||
		missingDutch > 0
	) {
		overallStatus = "incomplete";
	}

	const reportWithoutHash = {
		editionDate: factDossier.editionDate,
		editionId: factDossier.editionId,
		factDossierId: factDossier.dossierId,
		editorialManifestId: editorialManifest.manifestId,
		totalSelectedStories: selectedStories.length,
		claimMappings,
		summary: {
			consistentClaims,
			divergentClaims,
			missingEnglishArticle,
			missingEnglishListening,
			missingDutch,
			criticalDivergences,
			majorDivergences,
		},
		overallStatus,
		validationTimestamp: new Date().toISOString(),
		contentHash: "",
	};

	const contentHash = computeContentHash(JSON.stringify(reportWithoutHash));

	return {
		...reportWithoutHash,
		contentHash,
	};
}

/**
 * Find passage references for a specific claim ID in markdown
 */
function findPassageReferencesForClaim(
	markdown: string,
	claimId: string,
): PassageReference[] {
	const refs: PassageReference[] = [];
	const lines = markdown.split("\n");

	// Search for the claim ID directly
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line.includes(claimId)) {
			const charOffset =
				lines.slice(0, i).join("\n").length + line.indexOf(claimId);
			refs.push({
				characterOffset: Math.max(0, charOffset),
				lineNumber: i + 1,
				sectionHeading: findCurrentSection(lines, i),
				quote: line.trim().slice(0, 200),
			});
		}
	}

	// Also search for related terms (organization names, key phrases from the claim)
	// This is a simplified approach; in production, you'd use the traceability data
	return refs;
}

function findCurrentSection(
	lines: string[],
	lineIndex: number,
): string | undefined {
	for (let i = lineIndex; i >= 0; i--) {
		const match = lines[i].match(/^(#{1,6})\s+(.+)$/);
		if (match) return match[2].trim();
	}
	return undefined;
}

/**
 * Detect divergences between representations for a specific claim
 */
async function detectDivergences(
	claimId: string,
	dutchNewsletter: string,
	dutchListening: string,
	englishArticle: string,
	englishListening: string,
	dutchNewsletterRefs: PassageReference[],
	dutchListeningRefs: PassageReference[],
	englishArticleRefs: PassageReference[],
	englishListeningRefs: PassageReference[],
	factDossier: CanonicalFactDossier,
): Promise<DivergenceDetail[]> {
	const divergences: DivergenceDetail[] = [];

	// Find the claim in the fact dossier
	let targetClaim: ConsolidatedClaim | null = null;
	for (const candidate of factDossier.candidates) {
		const claim = candidate.claims.find((c) => c.claimId === claimId);
		if (claim) {
			targetClaim = claim;
			break;
		}
	}

	if (!targetClaim) return divergences;

	// Check for numerical differences
	const numericalDivergences = checkNumericalConsistency(
		claimId,
		targetClaim,
		dutchNewsletterRefs,
		dutchListeningRefs,
		englishArticleRefs,
		englishListeningRefs,
	);
	divergences.push(...numericalDivergences);

	// Check for date/version differences
	const temporalDivergences = checkTemporalConsistency(
		claimId,
		targetClaim,
		dutchNewsletterRefs,
		dutchListeningRefs,
		englishArticleRefs,
		englishListeningRefs,
	);
	divergences.push(...temporalDivergences);

	// Check for maturity/availability differences
	const maturityDivergences = checkMaturityConsistency(
		claimId,
		targetClaim,
		dutchNewsletterRefs,
		dutchListeningRefs,
		englishArticleRefs,
		englishListeningRefs,
	);
	divergences.push(...maturityDivergences);

	// Check for certainty/evidence classification differences
	const certaintyDivergences = checkCertaintyConsistency(
		claimId,
		targetClaim,
		dutchNewsletterRefs,
		dutchListeningRefs,
		englishArticleRefs,
		englishListeningRefs,
	);
	divergences.push(...certaintyDivergences);

	// Check for missing limitations
	const limitationDivergences = checkLimitationConsistency(
		claimId,
		targetClaim,
		dutchNewsletterRefs,
		dutchListeningRefs,
		englishArticleRefs,
		englishListeningRefs,
	);
	divergences.push(...limitationDivergences);

	return divergences;
}

/**
 * Check numerical consistency across representations
 */
function checkNumericalConsistency(
	claimId: string,
	claim: ConsolidatedClaim,
	dutchNewsletterRefs: PassageReference[],
	dutchListeningRefs: PassageReference[],
	englishArticleRefs: PassageReference[],
	englishListeningRefs: PassageReference[],
): DivergenceDetail[] {
	const divergences: DivergenceDetail[] = [];

	// Extract numbers from each representation's passages
	const allRefs = [
		...dutchNewsletterRefs.map((r) => ({
			...r,
			rep: "dutch-newsletter" as const,
		})),
		...dutchListeningRefs.map((r) => ({
			...r,
			rep: "dutch-listening" as const,
		})),
		...englishArticleRefs.map((r) => ({
			...r,
			rep: "english-article" as const,
		})),
		...englishListeningRefs.map((r) => ({
			...r,
			rep: "english-listening" as const,
		})),
	];

	const numbersByRep = new Map<string, Set<string>>();
	for (const ref of allRefs) {
		const numbers = extractNumbers(ref.quote);
		if (numbers.length > 0) {
			if (!numbersByRep.has(ref.rep))
				numbersByRep.set(ref.rep, new Set());
			for (const num of numbers) numbersByRep.get(ref.rep)!.add(num);
		}
	}

	// Compare numbers across representations
	const reps = [
		"dutch-newsletter",
		"dutch-listening",
		"english-article",
		"english-listening",
	];
	for (let i = 0; i < reps.length; i++) {
		for (let j = i + 1; j < reps.length; j++) {
			const rep1 = reps[i];
			const rep2 = reps[j];
			const nums1 = numbersByRep.get(rep1) ?? new Set();
			const nums2 = numbersByRep.get(rep2) ?? new Set();

			// Check for numbers in rep1 not in rep2 (and vice versa)
			for (const num of nums1) {
				if (!nums2.has(num) && nums2.size > 0) {
					divergences.push({
						type: "numerical-difference",
						description: `Numerical value "${num}" present in ${rep1} but not in ${rep2}`,
						dutchValue: rep1.startsWith("dutch") ? num : "",
						englishValue: rep2.startsWith("english") ? num : "",
						severity: "major",
						evidence: [num],
					});
				}
			}
		}
	}

	return divergences;
}

/**
 * Check temporal consistency (dates, versions)
 */
function checkTemporalConsistency(
	claimId: string,
	claim: ConsolidatedClaim,
	dutchNewsletterRefs: PassageReference[],
	dutchListeningRefs: PassageReference[],
	englishArticleRefs: PassageReference[],
	englishListeningRefs: PassageReference[],
): DivergenceDetail[] {
	const divergences: DivergenceDetail[] = [];

	// Extract date-like patterns and version strings
	const allRefs = [
		...dutchNewsletterRefs.map((r) => ({
			...r,
			rep: "dutch-newsletter" as const,
		})),
		...dutchListeningRefs.map((r) => ({
			...r,
			rep: "dutch-listening" as const,
		})),
		...englishArticleRefs.map((r) => ({
			...r,
			rep: "english-article" as const,
		})),
		...englishListeningRefs.map((r) => ({
			...r,
			rep: "english-listening" as const,
		})),
	];

	const temporalByRep = new Map<string, Set<string>>();
	for (const ref of allRefs) {
		const dates = extractDates(ref.quote);
		const versions = extractVersions(ref.quote);
		const temporal = [...dates, ...versions];
		if (temporal.length > 0) {
			if (!temporalByRep.has(ref.rep))
				temporalByRep.set(ref.rep, new Set());
			for (const t of temporal) temporalByRep.get(ref.rep)!.add(t);
		}
	}

	// Compare temporal references
	const reps = [
		"dutch-newsletter",
		"dutch-listening",
		"english-article",
		"english-listening",
	];
	for (let i = 0; i < reps.length; i++) {
		for (let j = i + 1; j < reps.length; j++) {
			const rep1 = reps[i];
			const rep2 = reps[j];
			const temp1 = temporalByRep.get(rep1) ?? new Set();
			const temp2 = temporalByRep.get(rep2) ?? new Set();

			for (const t of temp1) {
				if (!temp2.has(t) && temp2.size > 0) {
					divergences.push({
						type: "date-difference",
						description: `Temporal reference "${t}" present in ${rep1} but not in ${rep2}`,
						dutchValue: rep1.startsWith("dutch") ? t : "",
						englishValue: rep2.startsWith("english") ? t : "",
						severity: "major",
						evidence: [t],
					});
				}
			}
		}
	}

	return divergences;
}

/**
 * Check maturity/availability consistency
 */
function checkMaturityConsistency(
	claimId: string,
	claim: ConsolidatedClaim,
	dutchNewsletterRefs: PassageReference[],
	dutchListeningRefs: PassageReference[],
	englishArticleRefs: PassageReference[],
	englishListeningRefs: PassageReference[],
): DivergenceDetail[] {
	const divergences: DivergenceDetail[] = [];

	const maturityTerms = [
		"ga",
		"preview",
		"experimental",
		"deprecated",
		"general",
		"limited",
		"waitlist",
		"internal",
		"released",
		"announced",
		"research",
	];

	const allRefs = [
		...dutchNewsletterRefs.map((r) => ({
			...r,
			rep: "dutch-newsletter" as const,
		})),
		...dutchListeningRefs.map((r) => ({
			...r,
			rep: "dutch-listening" as const,
		})),
		...englishArticleRefs.map((r) => ({
			...r,
			rep: "english-article" as const,
		})),
		...englishListeningRefs.map((r) => ({
			...r,
			rep: "english-listening" as const,
		})),
	];

	const maturityByRep = new Map<string, Set<string>>();
	for (const ref of allRefs) {
		const found = maturityTerms.filter((term) =>
			ref.quote.toLowerCase().includes(term),
		);
		if (found.length > 0) {
			if (!maturityByRep.has(ref.rep))
				maturityByRep.set(ref.rep, new Set());
			for (const m of found) maturityByRep.get(ref.rep)!.add(m);
		}
	}

	// Compare maturity terms
	const reps = [
		"dutch-newsletter",
		"dutch-listening",
		"english-article",
		"english-listening",
	];
	for (let i = 0; i < reps.length; i++) {
		for (let j = i + 1; j < reps.length; j++) {
			const rep1 = reps[i];
			const rep2 = reps[j];
			const mat1 = maturityByRep.get(rep1) ?? new Set();
			const mat2 = maturityByRep.get(rep2) ?? new Set();

			// Check for conflicting maturity terms
			for (const m1 of mat1) {
				for (const m2 of mat2) {
					if (areConflictingMaturityTerms(m1, m2)) {
						divergences.push({
							type: "maturity-difference",
							description: `Conflicting maturity terms: "${m1}" in ${rep1} vs "${m2}" in ${rep2}`,
							dutchValue: rep1.startsWith("dutch") ? m1 : "",
							englishValue: rep2.startsWith("english") ? m2 : "",
							severity: "critical",
							evidence: [m1, m2],
						});
					}
				}
			}
		}
	}

	return divergences;
}

function areConflictingMaturityTerms(term1: string, term2: string): boolean {
	const conflictingPairs = [
		["ga", "preview"],
		["ga", "experimental"],
		["ga", "deprecated"],
		["preview", "experimental"],
		["general", "limited"],
		["general", "waitlist"],
		["general", "internal"],
		["released", "announced"],
		["released", "research"],
	];
	return conflictingPairs.some(
		([a, b]) =>
			(a === term1 && b === term2) || (a === term2 && b === term1),
	);
}

/**
 * Check certainty/evidence classification consistency
 */
function checkCertaintyConsistency(
	claimId: string,
	claim: ConsolidatedClaim,
	dutchNewsletterRefs: PassageReference[],
	dutchListeningRefs: PassageReference[],
	englishArticleRefs: PassageReference[],
	englishListeningRefs: PassageReference[],
): DivergenceDetail[] {
	const divergences: DivergenceDetail[] = [];

	const certaintyTerms = [
		"verified",
		"unverified",
		"vendor claim",
		"research finding",
		"expert interpretation",
		"original reporting",
		"inference",
		"speculation",
		"according to",
		"claims that",
		"independent verification",
		"independent replication",
		"peer reviewed",
	];

	const allRefs = [
		...dutchNewsletterRefs.map((r) => ({
			...r,
			rep: "dutch-newsletter" as const,
		})),
		...dutchListeningRefs.map((r) => ({
			...r,
			rep: "dutch-listening" as const,
		})),
		...englishArticleRefs.map((r) => ({
			...r,
			rep: "english-article" as const,
		})),
		...englishListeningRefs.map((r) => ({
			...r,
			rep: "english-listening" as const,
		})),
	];

	const certaintyByRep = new Map<string, Set<string>>();
	for (const ref of allRefs) {
		const found = certaintyTerms.filter((term) =>
			ref.quote.toLowerCase().includes(term.toLowerCase()),
		);
		if (found.length > 0) {
			if (!certaintyByRep.has(ref.rep))
				certaintyByRep.set(ref.rep, new Set());
			for (const c of found) certaintyByRep.get(ref.rep)!.add(c);
		}
	}

	// Check for stronger certainty in English than Dutch (which would be a problem)
	for (const dutchRep of ["dutch-newsletter", "dutch-listening"]) {
		for (const englishRep of ["english-article", "english-listening"]) {
			const dutchTerms = certaintyByRep.get(dutchRep) ?? new Set();
			const englishTerms = certaintyByRep.get(englishRep) ?? new Set();

			// If English has "verified" but Dutch has "vendor claim" -> problem
			if (
				englishTerms.has("verified") &&
				dutchTerms.has("vendor claim")
			) {
				divergences.push({
					type: "certainty-difference",
					description: `English representation uses stronger certainty ("verified") than Dutch ("vendor claim")`,
					dutchValue: "vendor claim",
					englishValue: "verified",
					severity: "critical",
					evidence: ["verified", "vendor claim"],
				});
			}
		}
	}

	return divergences;
}

/**
 * Check limitation/counterevidence consistency
 */
function checkLimitationConsistency(
	claimId: string,
	claim: ConsolidatedClaim,
	dutchNewsletterRefs: PassageReference[],
	dutchListeningRefs: PassageReference[],
	englishArticleRefs: PassageReference[],
	englishListeningRefs: PassageReference[],
): DivergenceDetail[] {
	const divergences: DivergenceDetail[] = [];

	// If the claim has counterevidence or unresolved uncertainties in the dossier,
	// check that they appear in all representations
	if (
		claim.contradictoryEvidence.length === 0 &&
		claim.uncertainty.unresolved.length === 0
	) {
		return divergences;
	}

	const limitationTerms = [
		"limitation",
		"caveat",
		"uncertain",
		"counterevidence",
		"contradict",
		"unresolved",
		"blocking",
		"note:",
	];

	const allRefs = [
		...dutchNewsletterRefs.map((r) => ({
			...r,
			rep: "dutch-newsletter" as const,
		})),
		...dutchListeningRefs.map((r) => ({
			...r,
			rep: "dutch-listening" as const,
		})),
		...englishArticleRefs.map((r) => ({
			...r,
			rep: "english-article" as const,
		})),
		...englishListeningRefs.map((r) => ({
			...r,
			rep: "english-listening" as const,
		})),
	];

	const limitationByRep = new Map<string, boolean>();
	for (const ref of allRefs) {
		const hasLimitation = limitationTerms.some((term) =>
			ref.quote.toLowerCase().includes(term),
		);
		limitationByRep.set(ref.rep, hasLimitation);
	}

	// Check if Dutch has limitations but English doesn't
	for (const dutchRep of ["dutch-newsletter", "dutch-listening"]) {
		for (const englishRep of ["english-article", "english-listening"]) {
			const dutchHas = limitationByRep.get(dutchRep) ?? false;
			const englishHas = limitationByRep.get(englishRep) ?? false;

			if (dutchHas && !englishHas) {
				divergences.push({
					type: "missing-limitation",
					description: `Dutch representation (${dutchRep}) includes limitations/caveats but English (${englishRep}) does not`,
					dutchValue: "limitations present",
					englishValue: "limitations absent",
					severity: "major",
					evidence: ["missing limitation in English"],
				});
			}
		}
	}

	return divergences;
}

/**
 * Extract numbers from text
 */
function extractNumbers(text: string): string[] {
	// Match percentages, decimals, integers, scientific notation
	const numberPattern = /\b\d+(?:\.\d+)?(?:%|[eE][+-]?\d+)?\b/g;
	const matches = text.match(numberPattern) ?? [];
	return [...new Set(matches)];
}

/**
 * Extract date-like patterns from text
 */
function extractDates(text: string): string[] {
	const datePatterns = [
		/\b\d{4}-\d{2}-\d{2}\b/g, // YYYY-MM-DD
		/\b\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/gi,
		/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi,
	];
	const matches: string[] = [];
	for (const pattern of datePatterns) {
		const found = text.match(pattern) ?? [];
		matches.push(...found);
	}
	return [...new Set(matches)];
}

/**
 * Extract version strings from text
 */
function extractVersions(text: string): string[] {
	const versionPattern = /\bv?\d+\.\d+(?:\.\d+)?(?:-[a-zA-Z0-9]+)?\b/g;
	const matches = text.match(versionPattern) ?? [];
	return [...new Set(matches)];
}

function computeContentHash(content: string): string {
	return `sha256:${createHash("sha256").update(content, "utf8").digest("hex")}`;
}
