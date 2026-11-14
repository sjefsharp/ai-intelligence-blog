/**
 * Publication Acceptance Authority — Public API
 *
 * Single entry point for the publication acceptance framework.
 * This module is the single deterministic authority for deciding whether a
 * daily bilingual edition satisfies all mandatory requirements and is eligible
 * for publication.
 *
 * The acceptance framework does NOT publish, deploy, schedule or activate
 * anything. It evaluates required evidence, applies deterministic acceptance
 * rules, identifies unresolved blocking conditions, authorizes the VALIDATED
 * lifecycle transition when justified, and produces an inspectable release
 * decision.
 */

// Schema layer
export * from "./schema.js";

// Gate registry
export * from "./gate-registry.js";

// Aggregation engine
export * from "./aggregation.js";

// Evaluator
export * from "./evaluator.js";

// Report generator
export * from "./report-generator.js";
