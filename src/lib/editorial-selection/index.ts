/**
 * Editorial Selection — Module Exports
 *
 * Evidence-driven, vendor-neutral editorial ranking and selection stage.
 * Consumes the canonical fact dossier, omission review and historical
 * regression, and produces the structured editorial selection manifest for
 * downstream publication generators.
 *
 * This stage does not re-implement source retrieval, temporal classification,
 * evidence verification, omission detection or historical regression. It does
 * not generate articles or publish content.
 */

export * from "./schema.js";
export * from "./config.js";
export * from "./similarity.js";
export * from "./eligibility.js";
export * from "./dimensions.js";
export * from "./merging.js";
export * from "./decisions.js";
export * from "./review.js";
export * from "./ordering.js";
export * from "./semantic.js";
export * from "./store.js";
export * from "./engine.js";
