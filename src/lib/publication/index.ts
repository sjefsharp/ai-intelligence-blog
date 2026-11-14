/**
 * Canonical Daily Publication — Public API
 *
 * Single entry point for the publication module.
 * Re-exports all schemas, utilities, and functions.
 */

// Schema layer
export * from "./schema.js";

// Path conventions
export * from "./paths.js";

// Metadata management
export * from "./metadata.js";

// Persistence & store
export * from "./store.js";

// Newsletter generation (Dutch canonical)
export * from "./newsletter-generator.js";

// Listening narrative generation (Dutch canonical)
export * from "./listening-narrative-generator.js";

// English article generation (derivative)
export * from "./english-article-generator.js";

// English listening narrative generation (derivative)
export * from "./english-listening-narrative-generator.js";

// Cross-language consistency validation
export * from "./cross-language-validator.js";

// Astro adapter for static website rendering
export * from "./astro-adapter.js";

// Resolve ambiguous re-exports between canonical and derivative generators.
export { computeContentHash } from "./metadata.js";
export {
	parseTemporalTimestamp,
	formatWindowListening,
	getMaxVerificationLevelListening,
	computeContentHashListening,
	countWordsListening,
} from "./listening-narrative-generator.js";
export { countWords } from "./english-article-generator.js";
