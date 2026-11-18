/**
 * Phase D — Editorial Decision: Selection Completeness Validation
 *
 * Verifies that all selected stories have complete evidence, no blocking
 * unresolved issues, and all editorial dependencies are resolved.
 */

import {
	validateSelectionCompleteness,
	resolveEditorialDependencies,
} from "../../editorial-selection/index.js";

/**
 * Validate Selection Completeness (D02_VALIDATE_SELECTION_COMPLETENESS).
 * Entry point for workflow stage D02.
 * Verifies that all selected stories have complete evidence and no blocking unresolved issues.
 */
export async function validateSelectionCompletenessWrapper(
	input: any,
): Promise<any> {
	const result = await validateSelectionCompleteness(input);

	return {
		...result,
		validated: true,
		validatedAt: new Date().toISOString(),
		validatedBy: "selection-completeness-validator",
	};
}

/**
 * Resolve Editorial Dependencies (D03_RESOLVE_EDITORIAL_DEPENDENCIES).
 * Entry point for workflow stage D03.
 * Applies existing contracts to resolve any remaining editorial dependencies.
 */
export async function resolveEditorialDependenciesWrapper(
	input: any,
): Promise<any> {
	const result = await resolveEditorialDependencies(input);

	return {
		...result,
		resolved: true,
		resolvedAt: new Date().toISOString(),
		resolvedBy: "editorial-dependency-resolver",
	};
}

export { validateSelectionCompletenessWrapper as validateSelectionCompleteness };
export { resolveEditorialDependenciesWrapper as resolveEditorialDependencies };
