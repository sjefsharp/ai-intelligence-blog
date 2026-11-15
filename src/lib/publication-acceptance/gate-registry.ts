/**
 * Publication Acceptance Authority — Gate Registry
 *
 * Defines the complete gate registry with all mandatory and conditional gates
 * for the final publication acceptance framework. Each gate is versioned and
 * declares its dependencies, required inputs, applicability conditions, and
 * validation rules.
 *
 * Gate Registry:
 * - T: Temporal Integrity
 * - D: Discovery Coverage
 * - E: Evidence Integrity
 * - H: Historical Regression
 * - X: Editorial Integrity
 * - R: Readable Accessibility
 * - A: Audio-First Quality
 * - K: Knowledge Continuity
 * - P: Publication Integrity
 * - C: Cross-Language Consistency
 * - L: Lifecycle Correctness
 *
 * Design rules:
 * - Reuses existing authoritative gate names and identifiers.
 * - Preserves the established R — Readable Accessibility gate.
 * - Preserves the established K — Knowledge Continuity gate.
 * - Does not invent a competing gate taxonomy.
 */

import {
	ACCEPTANCE_ID_PATTERNS,
	type AcceptanceGateDefinition,
} from "./schema.js";

// ============================================================================
// Gate Definitions
// ============================================================================

/**
 * T — Temporal Integrity Gate.
 * Verifies edition identity, reporting interval, first-disclosure evidence,
 * novelty classification, and historical context.
 */
export const TEMPORAL_INTEGRITY_GATE: AcceptanceGateDefinition = {
	gateId: "gate_temporal_integrity",
	name: "T — Temporal Integrity",
	purpose:
		"Verify correct edition identity, timezone-aware reporting interval, valid first-disclosure evidence, correct novelty classification, and appropriate historical context.",
	scope: "edition",
	requiredInputArtifacts: [
		"edition-context",
		"canonical-fact-dossier",
		"temporal-eligibility-classifications",
	],
	requiredUpstreamGates: [],
	applicabilityConditions: [
		"Edition identity must be resolved and valid.",
		"Reporting interval must be computed from edition date (not execution time).",
		"All selected candidates must have temporal eligibility classification.",
	],
	validationRules: [
		"Edition identity matches requested edition.",
		"Reporting interval is [previous day 05:00, edition day 05:00) Europe/Amsterdam.",
		"DST-aware interval is correct (23h spring forward, 24h normal, 25h fall back).",
		"All selected candidates have valid temporal eligibility status.",
		"No candidate has unresolved temporal eligibility.",
		"Novelty classification is from the authoritative upstream classifier.",
		"First-disclosure timestamps are traceable to original sources.",
	],
	evidenceReferences: [
		"src/lib/editorial-window.ts",
		"src/lib/novelty-classification.ts",
		"src/lib/fact-dossier/schema.ts (TemporalEligibilitySchema)",
	],
	evaluatorVersion: "1.0.0",
	humanReviewRequired: false,
	mandatory: true,
};

/**
 * D — Discovery Coverage Gate.
 * Verifies mandatory source monitoring, three-ring discovery completeness,
 * accurate source-status reporting, and independent omission review.
 */
export const DISCOVERY_COVERAGE_GATE: AcceptanceGateDefinition = {
	gateId: "gate_discovery_coverage",
	name: "D — Discovery Coverage",
	purpose:
		"Verify that the established source-discovery requirements were actually executed across all three rings, mandatory developer-tool monitoring was completed, source statuses are accurately reported, and independent omission review was completed.",
	scope: "edition",
	requiredInputArtifacts: [
		"discovery-ledger",
		"source-registry",
		"omission-review-report",
		"mandatory-coverage-report",
	],
	requiredUpstreamGates: [],
	applicabilityConditions: [
		"All three discovery rings must have been executed.",
		"Mandatory developer-tool and coding-agent monitoring must have been executed.",
		"Independent omission review must have been completed.",
	],
	validationRules: [
		"Ring 1 official first-party sources were monitored.",
		"Ring 2 independent research sources were monitored.",
		"Ring 3 expert and community sources were monitored.",
		"Mandatory developer-tool and coding-agent monitoring was executed.",
		"Source registry coverage is complete.",
		"Inaccessible sources are explicitly reported as INACCESSIBLE.",
		"Sources never checked are reported as NOT_CHECKED.",
		"Independent omission review was completed.",
		"Omission review has no unresolved critical omissions.",
	],
	evidenceReferences: [
		"src/lib/discovery-ledger/",
		"src/lib/omission-review/",
		"data/sources.yml",
		"data/research-taxonomy.yml",
	],
	evaluatorVersion: "1.0.0",
	humanReviewRequired: false,
	mandatory: true,
};

/**
 * E — Evidence Integrity Gate.
 * Verifies verified material claims, original source provenance, research
 * methodology, uncertainty and limitations, and absence of fabricated claims.
 */
export const EVIDENCE_INTEGRITY_GATE: AcceptanceGateDefinition = {
	gateId: "gate_evidence_integrity",
	name: "E — Evidence Integrity",
	purpose:
		"Verify that the final publication contains no material factual assertions unsupported by the canonical fact dossier, with original source provenance, research methodology, uncertainty and limitations, and absence of fabricated claims.",
	scope: "edition",
	requiredInputArtifacts: [
		"canonical-fact-dossier",
		"verified-claims",
		"evidence-verification-records",
	],
	requiredUpstreamGates: [],
	applicabilityConditions: [
		"Canonical fact dossier must be complete and valid.",
		"All material claims must have verification records.",
	],
	validationRules: [
		"All material claims have verified evidence.",
		"Original sources are correctly attributed.",
		"Evidence classifications are accurate (VERIFIED_FACT, VENDOR_CLAIM, RESEARCH_FINDING, etc.).",
		"Product versions and release maturity are correctly stated.",
		"Numerical findings include benchmark conditions.",
		"Research methodology is documented.",
		"Relevant counterevidence is included.",
		"Uncertainty is explicitly stated.",
		"Technical mechanisms are correctly explained.",
		"Strategic and economic interpretations are distinguished from facts.",
		"No fabricated or contradictory factual claims exist.",
	],
	evidenceReferences: [
		"src/lib/evidence-verification/",
		"src/lib/fact-dossier/schema.ts (ConsolidatedClaimSchema)",
	],
	evaluatorVersion: "1.0.0",
	humanReviewRequired: false,
	mandatory: true,
};

/**
 * H — Historical Regression Gate.
 * Verifies seven-calendar-day comparison, previously covered material,
 * genuine substantive updates, and explicit catch-up handling.
 */
export const HISTORICAL_REGRESSION_GATE: AcceptanceGateDefinition = {
	gateId: "gate_historical_regression",
	name: "H — Historical Regression",
	purpose:
		"Verify that the historical comparison was completed according to its existing seven-calendar-day contract, with historical records actually consulted, previously reported developments identified, genuine substantive changes classified, and explicit catch-up handling.",
	scope: "edition",
	requiredInputArtifacts: [
		"historical-regression-report",
		"canonical-fact-dossier",
	],
	requiredUpstreamGates: [],
	applicabilityConditions: [
		"Historical regression must have been executed.",
		"Historical records must be accessible for comparison.",
	],
	validationRules: [
		"Seven-calendar-day comparison was completed.",
		"Historical records were actually consulted.",
		"Previously reported developments are identified.",
		"Genuine substantive changes are classified as SUBSTANTIVE_UPDATE.",
		"Duplicated reporting is classified as REPEATED_REPORTING.",
		"Newly disclosed older events are classified as NEWLY_DISCLOSED_HISTORICAL.",
		"Explicit catch-up classifications are recorded.",
		"Relevant historical references are included.",
		"Unresolved comparison limitations are reported.",
	],
	evidenceReferences: [
		"src/lib/historical-regression/",
		"docs/historical-regression.md",
	],
	evaluatorVersion: "1.0.0",
	humanReviewRequired: false,
	mandatory: true,
};

/**
 * X — Editorial Integrity Gate.
 * Verifies valid selection manifest, complete selected-story coverage,
 * vendor-neutral significance, and scientific and strategic research treatment.
 */
export const EDITORIAL_INTEGRITY_GATE: AcceptanceGateDefinition = {
	gateId: "gate_editorial_integrity",
	name: "X — Editorial Integrity",
	purpose:
		"Validate the editorial selection manifest against the canonical fact dossier and completed discovery evidence, ensuring valid story identifiers, verified eligibility, explicit editorial selection, required ordering, coverage of materially significant developments, no unsupported additional stories, no unexplained omission of selected stories, vendor-neutral editorial treatment, and appropriate scientific, economic and strategic research coverage.",
	scope: "edition",
	requiredInputArtifacts: [
		"editorial-selection-manifest",
		"canonical-fact-dossier",
		"discovery-ledger",
	],
	requiredUpstreamGates: [],
	applicabilityConditions: [
		"Editorial selection manifest must be valid.",
		"Canonical fact dossier must be complete.",
		"Discovery evidence must be complete.",
	],
	validationRules: [
		"Story identifiers are valid and unique.",
		"All selected stories have verified eligibility.",
		"Editorial selection decisions are explicit.",
		"Required ordering is preserved.",
		"Coverage of materially significant developments is complete.",
		"No unsupported additional stories are included.",
		"No unexplained omission of selected stories exists.",
		"Vendor-neutral editorial treatment is maintained.",
		"Scientific, economic and strategic research coverage is appropriate.",
		"Uncertainty is explicitly treated.",
	],
	evidenceReferences: [
		"src/lib/editorial-selection/",
		"docs/editorial-selection.md",
	],
	evaluatorVersion: "1.0.0",
	humanReviewRequired: false,
	mandatory: true,
};

/**
 * R — Readable Accessibility Gate.
 * Reuses the readable-publication evaluation framework implemented in step 95.
 * Validates Dutch and English readable representations.
 */
export const READABLE_ACCESSIBILITY_GATE: AcceptanceGateDefinition = {
	gateId: "gate_readable_accessibility",
	name: "R — Readable Accessibility",
	purpose:
		"Validate Dutch and English readable representations against the readable-publication evaluation framework, ensuring factual fidelity, selected-story completeness, technical depth, scientific and strategic research accuracy, first-screen clarity, progressive disclosure, information hierarchy, ADHD-aware cognitive accessibility, accessible terminology, source transparency, meaningful visual alternatives, relevant WCAG 2.2 AA content checks, and correct bilingual metadata.",
	scope: "artifact",
	requiredInputArtifacts: [
		"readable-quality-evaluation",
		"dutch-publication",
		"english-publication",
		"visualization-accessibility-report",
	],
	requiredUpstreamGates: ["gate_editorial_integrity"],
	applicabilityConditions: [
		"Readable quality evaluation must have been executed.",
		"Dutch and English readable publications must exist.",
		"Visualization accessibility must have been checked (if visualizations exist).",
	],
	validationRules: [
		"Factual fidelity is maintained.",
		"Selected-story completeness is verified.",
		"Technical depth is preserved.",
		"Scientific and strategic research accuracy is verified.",
		"First-screen clarity is established.",
		"Progressive disclosure is implemented.",
		"Information hierarchy is correct.",
		"ADHD-aware cognitive accessibility is verified.",
		"Accessible terminology is used.",
		"Source transparency is maintained.",
		"Meaningful visual alternatives are provided.",
		"Relevant WCAG 2.2 AA content checks pass.",
		"Correct bilingual metadata is present.",
	],
	evidenceReferences: [
		"src/lib/readable-publication-evaluation/",
		"src/lib/visualization/",
	],
	evaluatorVersion: "1.0.0",
	humanReviewRequired: true,
	mandatory: true,
};

/**
 * A — Audio-First Quality Gate.
 * Reuses the existing Q1–Q10 and audio A–G evaluation results.
 * Validates both Dutch and English listening narratives.
 */
export const AUDIO_FIRST_QUALITY_GATE: AcceptanceGateDefinition = {
	gateId: "gate_audio_first_quality",
	name: "A — Audio-First Quality",
	purpose:
		"Validate both Dutch and English listening narratives against Q1–Q10 and audio A–G evaluation results, ensuring independent authoring from the canonical factual foundation, complete story coverage, correct technical mechanisms, intact important caveats, understandable terminology, concrete opening, natural narrative transitions, appropriate cognitive load management, no operational metadata in spoken text, and no dependency on visual references.",
	scope: "artifact",
	requiredInputArtifacts: [
		"q1q10-evaluation",
		"audio-ag-evaluation",
		"dutch-listening-narrative",
		"english-listening-narrative",
	],
	requiredUpstreamGates: ["gate_editorial_integrity"],
	applicabilityConditions: [
		"Q1–Q10 evaluation must have been executed.",
		"Audio A–G evaluation must have been executed.",
		"Dutch and English listening narratives must exist.",
	],
	validationRules: [
		"Each narrative is independently authored from the canonical factual foundation.",
		"Every materially selected story is represented.",
		"Technical mechanisms are explained correctly.",
		"Important caveats remain intact.",
		"Terminology is understandable.",
		"The opening is concrete.",
		"Narrative transitions are natural.",
		"Cognitive load is appropriately managed.",
		"Spoken text does not contain operational metadata.",
		"The narrative does not depend on visual references.",
		"The complete listening experience has been assessed.",
	],
	evidenceReferences: ["src/lib/listening-quality-evaluation/"],
	evaluatorVersion: "1.0.0",
	humanReviewRequired: false,
	mandatory: true,
};

/**
 * K — Knowledge Continuity Gate.
 * Reuses the existing knowledge-continuity framework.
 * Verifies persistent thesaurus, architecture-principles register, Book Delta
 * evaluation, historical continuity, and verified persistence and readback.
 */
export const KNOWLEDGE_CONTINUITY_GATE: AcceptanceGateDefinition = {
	gateId: "gate_knowledge_continuity",
	name: "K — Knowledge Continuity",
	purpose:
		"Verify persistent thesaurus, architecture-principles register, Book Delta evaluation, historical continuity, and verified persistence and readback, ensuring that knowledge registers were successfully read, candidate terminology evaluated, verified updates handled according to policy, no unauthorized definition changes, persistence and readback verified, and that a legitimate NONE result is acceptable while a skipped assessment is not.",
	scope: "knowledge",
	requiredInputArtifacts: [
		"thesaurus-artifact",
		"architecture-principles-register",
		"book-delta-artifact",
		"knowledge-continuity-result",
	],
	requiredUpstreamGates: [],
	applicabilityConditions: [
		"Thesaurus evaluation must have been executed.",
		"Architecture principles evaluation must have been executed.",
		"Book Delta evaluation must have been executed.",
	],
	validationRules: [
		"Existing thesaurus register was successfully read.",
		"Candidate terminology was evaluated.",
		"Verified updates were handled according to policy.",
		"No unauthorized definition changes were made.",
		"Thesaurus persistence and readback were verified.",
		"Existing architecture principles register was successfully read.",
		"ADD, CONFIRM, REFINE, MERGE, SUPERSEDE or NONE correctly recorded.",
		"Evidence and relationships were validated.",
		"Architecture principles persistence and readback were verified.",
		"Book Delta assessment was actually executed.",
		"Educational improvement proposals were evaluated.",
		"Historical proposals were deduplicated.",
		"Approval boundaries were respected.",
		"Results were recorded in research-audit.md.",
	],
	evidenceReferences: [
		"src/lib/thesaurus/",
		"src/lib/architecture-principles/",
		"src/lib/book-delta/",
	],
	evaluatorVersion: "1.0.0",
	humanReviewRequired: false,
	mandatory: true,
};

/**
 * P — Publication Integrity Gate.
 * Verifies required artifacts, valid metadata, cross-language consistency,
 * lifecycle correctness, artifact integrity, and safe release preparation.
 */
export const PUBLICATION_INTEGRITY_GATE: AcceptanceGateDefinition = {
	gateId: "gate_publication_integrity",
	name: "P — Publication Integrity",
	purpose:
		"Verify required artifacts, valid metadata, cross-language consistency, lifecycle correctness, artifact integrity, and safe release preparation, ensuring exactly three canonical daily Markdown documents with correct daily directory, correct filenames, UTF-8 encoding, valid Markdown structure, correct edition metadata, source and claim traceability, complete required sections, valid document references, consistent artifact lifecycle state, accurate creation and modification metadata, successful persistence, independent readback, and content hashes matching evaluated artifacts.",
	scope: "artifact",
	requiredInputArtifacts: [
		"publication-package",
		"publication-metadata",
		"daily-index",
		"english-derivatives",
	],
	requiredUpstreamGates: [
		"gate_editorial_integrity",
		"gate_readable_accessibility",
	],
	applicabilityConditions: [
		"All three canonical documents must exist.",
		"Publication package must be valid.",
		"Daily index must be valid.",
		"English derivatives must exist.",
	],
	validationRules: [
		"Exactly three canonical daily Markdown documents exist.",
		"Correct daily directory is used.",
		"Correct filenames are used.",
		"UTF-8 encoding is verified.",
		"Valid Markdown structure is verified.",
		"Correct edition metadata is present.",
		"Source and claim traceability is verified.",
		"Complete required sections are present.",
		"Valid document references are verified.",
		"Consistent artifact lifecycle state is maintained.",
		"Accurate creation and modification metadata is present.",
		"Successful persistence is verified.",
		"Independent readback is verified.",
		"Content hashes match evaluated artifacts.",
	],
	evidenceReferences: [
		"src/lib/publication/",
		"docs/ai-intelligence-contract.md",
	],
	evaluatorVersion: "1.0.0",
	humanReviewRequired: false,
	mandatory: true,
};

/**
 * C — Cross-Language Consistency Gate.
 * Verifies consistency between Dutch and English publications and listening
 * narratives, and the shared canonical fact dossier.
 */
export const CROSS_LANGUAGE_CONSISTENCY_GATE: AcceptanceGateDefinition = {
	gateId: "gate_cross_language_consistency",
	name: "C — Cross-Language Consistency",
	purpose:
		"Verify consistency between Dutch readable publication, English readable publication, Dutch listening narrative, English listening narrative, and shared canonical fact dossier, ensuring material story coverage, technical claims, product and model identifiers, dates and versions, quantitative findings, research interpretations, vendor attribution, important limitations, and source relationships are consistent.",
	scope: "artifact",
	requiredInputArtifacts: [
		"dutch-publication",
		"english-publication",
		"dutch-listening-narrative",
		"english-listening-narrative",
		"canonical-fact-dossier",
		"cross-language-validation-result",
	],
	requiredUpstreamGates: [
		"gate_editorial_integrity",
		"gate_publication_integrity",
	],
	applicabilityConditions: [
		"All four language representations must exist.",
		"Cross-language validation must have been executed.",
	],
	validationRules: [
		"Material story coverage is consistent.",
		"Technical claims are consistent.",
		"Product and model identifiers are consistent.",
		"Dates and versions are consistent.",
		"Quantitative findings are consistent.",
		"Research interpretations are consistent.",
		"Vendor attribution is consistent.",
		"Important limitations are consistent.",
		"Source relationships are consistent.",
	],
	evidenceReferences: ["src/lib/publication/cross-language-validator.ts"],
	evaluatorVersion: "1.0.0",
	humanReviewRequired: false,
	mandatory: true,
};

/**
 * L — Lifecycle Correctness Gate.
 * Verifies correct publication lifecycle state and valid transitions.
 */
export const LIFECYCLE_CORRECTNESS_GATE: AcceptanceGateDefinition = {
	gateId: "gate_lifecycle_correctness",
	name: "L — Lifecycle Correctness",
	purpose:
		"Verify correct publication lifecycle state and valid transitions, ensuring that the edition is in READY_FOR_VALIDATION state, all required upstream stages have completed, and the acceptance framework may transition an eligible edition to VALIDATED when all requirements are satisfied.",
	scope: "edition",
	requiredInputArtifacts: ["execution-manifest", "publication-metadata"],
	requiredUpstreamGates: [
		"gate_temporal_integrity",
		"gate_discovery_coverage",
		"gate_evidence_integrity",
		"gate_historical_regression",
		"gate_editorial_integrity",
		"gate_readable_accessibility",
		"gate_audio_first_quality",
		"gate_knowledge_continuity",
		"gate_publication_integrity",
		"gate_cross_language_consistency",
	],
	applicabilityConditions: [
		"Edition must be in READY_FOR_VALIDATION state.",
		"All required upstream stages must have completed.",
	],
	validationRules: [
		"Edition is in READY_FOR_VALIDATION state.",
		"All required upstream stages have completed.",
		"No unauthorized lifecycle changes have occurred.",
		"Lifecycle transition to VALIDATED is authorized by this acceptance framework.",
	],
	evidenceReferences: [
		"src/lib/publication/schema.ts (PublicationLifecycleStatusSchema)",
		"docs/ai-intelligence-contract.md",
	],
	evaluatorVersion: "1.0.0",
	humanReviewRequired: false,
	mandatory: true,
};

// ============================================================================
// Complete Gate Registry
// ============================================================================

/**
 * All acceptance gates in dependency order.
 * The order matters: gates are evaluated in this sequence.
 */
export const ACCEPTANCE_GATES: AcceptanceGateDefinition[] = [
	// Phase 1: Foundational gates (no dependencies)
	TEMPORAL_INTEGRITY_GATE,
	DISCOVERY_COVERAGE_GATE,
	EVIDENCE_INTEGRITY_GATE,
	HISTORICAL_REGRESSION_GATE,
	EDITORIAL_INTEGRITY_GATE,
	KNOWLEDGE_CONTINUITY_GATE,

	// Phase 2: Dependent gates
	READABLE_ACCESSIBILITY_GATE,
	AUDIO_FIRST_QUALITY_GATE,
	PUBLICATION_INTEGRITY_GATE,

	// Phase 3: Cross-cutting gates
	CROSS_LANGUAGE_CONSISTENCY_GATE,

	// Phase 4: Final gate
	LIFECYCLE_CORRECTNESS_GATE,
];

/**
 * Get gate definition by ID.
 */
export function getGateDefinition(
	gateId: string,
): AcceptanceGateDefinition | undefined {
	return ACCEPTANCE_GATES.find((g) => g.gateId === gateId);
}

/**
 * Get all mandatory gates.
 */
export function getMandatoryGates(): AcceptanceGateDefinition[] {
	return ACCEPTANCE_GATES.filter((g) => g.mandatory);
}

/**
 * Get gates by scope.
 */
export function getGatesByScope(
	scope: AcceptanceGateDefinition["scope"],
): AcceptanceGateDefinition[] {
	return ACCEPTANCE_GATES.filter((g) => g.scope === scope);
}

/**
 * Get topological order of gates based on dependencies.
 */
export function getGateTopologicalOrder(): string[] {
	const visited = new Set<string>();
	const result: string[] = [];
	const gateMap = new Map(ACCEPTANCE_GATES.map((g) => [g.gateId, g]));

	function visit(gateId: string) {
		if (visited.has(gateId)) return;
		const gate = gateMap.get(gateId);
		if (!gate) return;

		for (const depId of gate.requiredUpstreamGates) {
			visit(depId);
		}

		visited.add(gateId);
		result.push(gateId);
	}

	for (const gate of ACCEPTANCE_GATES) {
		visit(gate.gateId);
	}

	return result;
}

/**
 * Validate gate registry integrity.
 */
export function validateGateRegistry(): {
	valid: boolean;
	errors: string[];
	warnings: string[];
} {
	const errors: string[] = [];
	const warnings: string[] = [];

	// Check for duplicate gate IDs
	const ids = new Set<string>();
	for (const gate of ACCEPTANCE_GATES) {
		if (ids.has(gate.gateId)) {
			errors.push(`Duplicate gate ID: ${gate.gateId}`);
		}
		ids.add(gate.gateId);
	}

	// Check all dependencies reference existing gates
	for (const gate of ACCEPTANCE_GATES) {
		for (const depId of gate.requiredUpstreamGates) {
			if (!ids.has(depId)) {
				errors.push(
					`Gate ${gate.gateId} depends on unknown gate: ${depId}`,
				);
			}
		}
	}

	// Check for cycles
	const gateMap = new Map(ACCEPTANCE_GATES.map((g) => [g.gateId, g]));
	const visited = new Set<string>();
	const recStack = new Set<string>();

	function checkCycles(gateId: string, path: string[]): boolean {
		if (recStack.has(gateId)) {
			errors.push(`Cycle detected: ${[...path, gateId].join(" → ")}`);
			return true;
		}
		if (visited.has(gateId)) return false;

		visited.add(gateId);
		recStack.add(gateId);

		const gate = gateMap.get(gateId);
		if (gate) {
			for (const depId of gate.requiredUpstreamGates) {
				checkCycles(depId, [...path, gateId]);
			}
		}

		recStack.delete(gateId);
		return false;
	}

	for (const gate of ACCEPTANCE_GATES) {
		if (!visited.has(gate.gateId)) {
			checkCycles(gate.gateId, []);
		}
	}

	// Warn about gates with no dependencies and no dependents (isolated)
	const hasDependent = new Set<string>();
	for (const gate of ACCEPTANCE_GATES) {
		for (const depId of gate.requiredUpstreamGates) {
			hasDependent.add(depId);
		}
	}
	for (const gate of ACCEPTANCE_GATES) {
		if (
			gate.requiredUpstreamGates.length === 0 &&
			!hasDependent.has(gate.gateId)
		) {
			warnings.push(
				`Gate ${gate.gateId} (${gate.name}) is isolated - no dependencies and no dependents`,
			);
		}
	}

	return { valid: errors.length === 0, errors, warnings };
}
