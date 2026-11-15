/**
 * Historical Regression — Module Exports
 *
 * Rolling seven-calendar-day historical regression stage. Compares the current
 * canonical fact dossier against accessible previous editions and their
 * supporting evidence, producing structured findings for editorial selection.
 *
 * This stage does not redefine novelty classification, evidence verification,
 * omission detection or editorial ranking, and it never modifies previously
 * published editions.
 */

export * from "./schema.js";
export * from "./window.js";
export * from "./matching.js";
export * from "./classifier.js";
export * from "./edition-store.js";
export * from "./semantic.js";
export * from "./store.js";
export * from "./engine.js";
