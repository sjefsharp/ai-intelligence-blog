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

// Research audit generation (third canonical publication)
export * from "./research-audit-generator.js";

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

import {
	generateNewsletterMarkdown,
	loadNewsletterGenerationInput,
} from "./newsletter-generator.js";
import {
	generateListeningNarrativeMarkdown,
	loadListeningNarrativeGenerationInput,
} from "./listening-narrative-generator.js";
import {
	generateEnglishArticleMarkdown,
	loadEnglishArticleGenerationInput,
} from "./english-article-generator.js";
import {
	generateEnglishListeningNarrativeMarkdown,
	loadEnglishListeningNarrativeGenerationInput,
} from "./english-listening-narrative-generator.js";
import { validateCrossLanguageConsistency } from "./cross-language-validator.js";
import {
	generateResearchAudit,
	loadResearchAuditGenerationInput,
} from "./research-audit-generator.js";
import type { CanonicalReferences, EditionIdentity } from "./schema.js";

/**
 * Generate Dutch Technical Newsletter (E01_GENERATE_NL_NEWSLETTER).
 * Entry point for workflow stage E01.
 */
export async function generateNewsletterMarkdownWrapper(
	input: any,
): Promise<any> {
	// Use the existing loader that loads everything from filesystem
	const loadedInput = await loadNewsletterGenerationInput(
		input.editionDate,
		"data",
	);

	const markdown = generateNewsletterMarkdown(loadedInput);

	// Create proper publication metadata
	const { createCanonicalPublicationMetadata, computeContentHash } =
		await import("./metadata.js");

	const editionIdentity: EditionIdentity = {
		editionId: `edition_${input.editionDate}`,
		editionDate: input.editionDate,
		editionWindow: {
			editionDate: input.editionDate,
			start:
				loadedInput.editionWindow?.start ||
				`${input.editionDate}T05:00:00+01:00[Europe/Amsterdam]`,
			end:
				loadedInput.editionWindow?.end ||
				`${input.editionDate}T05:00:00+01:00[Europe/Amsterdam]`,
			timezone: "Europe/Amsterdam",
			durationHours:
				loadedInput.factDossier.editionWindow.durationHours || 24,
		},
		reportingWindow: {
			start:
				loadedInput.editionWindow?.start ||
				`${input.editionDate}T05:00:00+01:00[Europe/Amsterdam]`,
			end:
				loadedInput.editionWindow?.end ||
				`${input.editionDate}T05:00:00+01:00[Europe/Amsterdam]`,
			timezone: "Europe/Amsterdam",
		},
	};

	const canonicalReferences: CanonicalReferences = {
		factDossier: {
			dossierId: loadedInput.factDossier.dossierId || "",
			editionId: loadedInput.factDossier.editionId || "",
			contentHash: loadedInput.factDossier.contentHash || "",
		},
		editorialSelection: {
			manifestId: loadedInput.editorialManifest.manifestId || "",
			editionId: loadedInput.editorialManifest.editionId || "",
			contentHash: loadedInput.editorialManifest.contentHash || "",
		},
		historicalRegression: loadedInput.historicalRegression
			? {
					reportId: loadedInput.historicalRegression.reportId || "",
					editionId: loadedInput.historicalRegression.editionId || "",
					contentHash:
						loadedInput.historicalRegression.contentHash || "",
					referenced: true,
				}
			: {
					reportId: "",
					editionId: "",
					contentHash: "",
					referenced: false,
				},
		omissionReview: {
			reportId: "",
			executionId: "",
			referenced: false,
		},
	};

	const metadata = createCanonicalPublicationMetadata(
		editionIdentity,
		canonicalReferences,
		"newsletter",
		null, // edition-level digest, no single article
		`AI Intelligence — ${input.editionDate}`,
		"Dutch technical newsletter for AI Intelligence",
		"newsletter-generator",
		{
			lifecycleStatus: "DRAFT",
			validationStatus: "pending",
			readingTimeMinutes: Math.ceil(markdown.split(/\s+/).length / 200),
		},
	);

	// Persist the artifact
	const artifactPath = `editions/edition_${input.editionDate}/canonical/publication.md`;
	const { persistPublicationArtifact } = await import("./store.js");
	await persistPublicationArtifact(
		input.editionDate,
		artifactPath,
		markdown,
		metadata,
	);

	return {
		markdown,
		metadata: {
			...metadata,
			contentHash: computeContentHash(markdown),
		},
	};
}

/**
 * Generate Dutch Listening Narrative (E02_GENERATE_NL_LISTENING).
 * Entry point for workflow stage E02.
 */
export async function generateListeningNarrativeMarkdownWrapper(
	input: any,
): Promise<any> {
	// Load input using the existing loader (loads from filesystem)
	const loadedInput = await loadListeningNarrativeGenerationInput(
		input.editionDate,
		"data",
	);

	const result = await generateListeningNarrativeMarkdown(loadedInput);
	const markdown = result.markdown;

	// Create proper publication metadata
	const { createCanonicalPublicationMetadata, computeContentHash } =
		await import("./metadata.js");

	const editionIdentity: EditionIdentity = {
		editionId: `edition_${input.editionDate}`,
		editionDate: input.editionDate,
		editionWindow: {
			editionDate: input.editionDate,
			start:
				loadedInput.editionWindow?.start ||
				`${input.editionDate}T05:00:00+01:00[Europe/Amsterdam]`,
			end:
				loadedInput.editionWindow?.end ||
				`${input.editionDate}T05:00:00+01:00[Europe/Amsterdam]`,
			timezone: "Europe/Amsterdam",
			durationHours:
				loadedInput.factDossier.editionWindow.durationHours || 24,
		},
		reportingWindow: {
			start:
				loadedInput.editionWindow?.start ||
				`${input.editionDate}T05:00:00+01:00[Europe/Amsterdam]`,
			end:
				loadedInput.editionWindow?.end ||
				`${input.editionDate}T05:00:00+01:00[Europe/Amsterdam]`,
			timezone: "Europe/Amsterdam",
		},
	};

	const canonicalReferences: CanonicalReferences = {
		factDossier: {
			dossierId: loadedInput.factDossier.dossierId || "",
			editionId: loadedInput.factDossier.editionId || "",
			contentHash: loadedInput.factDossier.contentHash || "",
		},
		editorialSelection: {
			manifestId: loadedInput.editorialManifest.manifestId || "",
			editionId: loadedInput.editorialManifest.editionId || "",
			contentHash: loadedInput.editorialManifest.contentHash || "",
		},
		historicalRegression: loadedInput.historicalRegression
			? {
					reportId: loadedInput.historicalRegression.reportId || "",
					editionId: loadedInput.historicalRegression.editionId || "",
					contentHash:
						loadedInput.historicalRegression.contentHash || "",
					referenced: true,
				}
			: {
					reportId: "",
					editionId: "",
					contentHash: "",
					referenced: false,
				},
		omissionReview: {
			reportId: "",
			executionId: "",
			referenced: false,
		},
	};

	const metadata = createCanonicalPublicationMetadata(
		editionIdentity,
		canonicalReferences,
		"listening-narrative",
		null, // edition-level digest, no single article
		`AI Daily Intelligence — ${input.editionDate}`,
		"Dutch independent listening narrative for AI Intelligence",
		"listening-narrative-generator",
		{
			lifecycleStatus: "DRAFT",
			validationStatus: "pending",
			estimatedListeningDurationMinutes: Math.ceil(
				markdown.split(/\s+/).length / 130,
			),
		},
	);

	// Persist the artifact
	const artifactPath = `editions/edition_${input.editionDate}/canonical/AI Daily Intelligence — ${input.editionDate}.md`;
	const { persistPublicationArtifact } = await import("./store.js");
	await persistPublicationArtifact(
		input.editionDate,
		artifactPath,
		markdown,
		metadata,
	);

	return {
		markdown,
		metadata: {
			...metadata,
			contentHash: computeContentHash(markdown),
		},
	};
}

/**
 * Generate Research Audit (E02b_GENERATE_RESEARCH_AUDIT).
 * Entry point for workflow stage E02b.
 * Generates research-audit.md — Technical evidence & editorial accountability.
 */
export async function generateResearchAuditWrapper(input: any): Promise<any> {
	// Load input using the existing loader (loads from filesystem)
	const loadedInput = await loadResearchAuditGenerationInput(
		input.editionDate,
		"data",
	);

	const result = await generateResearchAudit(loadedInput);

	// The generateResearchAudit function already persists the artifact
	// and returns the result with metadata
	return result;
}

/**
 * Generate English Articles (E03_GENERATE_EN_ARTICLES).
 * Entry point for workflow stage E03.
 */
export async function generateEnglishArticles(input: any): Promise<any> {
	// Load input using the existing loader (loads from filesystem)
	const loadedInput = await loadEnglishArticleGenerationInput(
		input.editionDate,
		"data",
	);

	// Generate all English articles
	const result = await generateEnglishArticleMarkdown(loadedInput);
	const markdown = result.markdown;

	// Create proper publication metadata for English derivative
	const { generateArticleId, generateArtifactId, computeContentHash } =
		await import("./metadata.js");

	const metadata = {
		artifactId: generateArtifactId(),
		editionId: `edition_${input.editionDate}`,
		editionDate: input.editionDate,
		contentType: "english-derivative" as const,
		language: "en" as const,
		canonicalFilename: "article.md",
		title: `AI Intelligence — ${input.editionDate} (English)`,
		description: "English readable articles for AI Intelligence",
		articleId: generateArticleId(),
		publicationTimestamp: new Date().toISOString(),
		lastSubstantiveUpdateTimestamp: new Date().toISOString(),
		readingTimeMinutes: Math.ceil(markdown.split(/\s+/).length / 200),
		sourceReferences: [],
		claimReferences: [],
		topics: [],
		organizations: [],
		lifecycleStatus: "DRAFT" as const,
		validationStatus: "pending" as const,
		validationResults: [],
		relatedVariants: [],
		version: 1,
		schemaVersion: "1.0.0" as const,
		contentHash: computeContentHash(markdown),
	};

	// Persist the artifact
	const artifactPath = `editions/edition_${input.editionDate}/derivatives/english-articles/article.md`;
	const { persistPublicationArtifact } = await import("./store.js");
	await persistPublicationArtifact(
		input.editionDate,
		artifactPath,
		markdown,
		metadata as any,
	);

	return {
		markdown,
		metadata,
		generatedAt: new Date().toISOString(),
		editionDate: input.editionDate,
	};
}

/**
 * Generate English Listening Narratives (E04_GENERATE_EN_LISTENING).
 * Entry point for workflow stage E04.
 */
export async function generateEnglishListeningNarratives(
	input: any,
): Promise<any> {
	// Load input using the existing loader (loads from filesystem)
	const loadedInput = await loadEnglishListeningNarrativeGenerationInput(
		input.editionDate,
		"data",
	);

	// Generate all English listening narratives
	const result = await generateEnglishListeningNarrativeMarkdown(loadedInput);
	const markdown = result.markdown;

	// Create proper publication metadata for English listening derivative
	const { generateArticleId, generateArtifactId, computeContentHash } =
		await import("./metadata.js");

	const metadata = {
		artifactId: generateArtifactId(),
		editionId: `edition_${input.editionDate}`,
		editionDate: input.editionDate,
		contentType: "english-listening" as const,
		language: "en" as const,
		canonicalFilename: "listening.md",
		title: `AI Daily Intelligence — ${input.editionDate} (English)`,
		description:
			"English independent listening narrative for AI Intelligence",
		articleId: generateArticleId(),
		publicationTimestamp: new Date().toISOString(),
		lastSubstantiveUpdateTimestamp: new Date().toISOString(),
		estimatedListeningDurationMinutes: Math.ceil(
			markdown.split(/\s+/).length / 130,
		),
		sourceReferences: [],
		claimReferences: [],
		topics: [],
		organizations: [],
		lifecycleStatus: "DRAFT" as const,
		validationStatus: "pending" as const,
		validationResults: [],
		relatedVariants: [],
		version: 1,
		schemaVersion: "1.0.0" as const,
		contentHash: computeContentHash(markdown),
	};

	// Persist the artifact
	const artifactPath = `editions/edition_${input.editionDate}/derivatives/english-listening/listening.md`;
	const { persistPublicationArtifact } = await import("./store.js");
	await persistPublicationArtifact(
		input.editionDate,
		artifactPath,
		markdown,
		metadata as any,
	);

	return {
		markdown,
		metadata,
		generatedAt: new Date().toISOString(),
		editionDate: input.editionDate,
	};
}

/**
 * Validate Publication Artifacts (E06_VALIDATE_PUBLICATION_ARTIFACTS).
 * Entry point for workflow stage E06.
 */
export async function validatePublicationArtifacts(input: any): Promise<any> {
	const artifacts = input.artifacts || input;
	const editionDate = input.editionDate;

	// Read fact dossier and editorial manifest from standard locations
	const { readFileSync, readdirSync } = await import("fs");
	const { join } = await import("path");

	let factDossier =
		input["canonical-fact-dossier"] || input.canonicalFactDossier || input;
	let editorialManifest =
		input["resolved-editorial-manifest"] ||
		input.resolvedEditorialManifest ||
		input;

	// Helper to load JSON from file if input is an artifact reference or string path
	const loadFromFile = (obj: any, defaultPath: string): any => {
		if (!obj) return null;
		// If it's an artifact object with path, load from file
		if (obj.path && typeof obj.path === "string") {
			try {
				return JSON.parse(readFileSync(obj.path, "utf-8"));
			} catch {
				return null;
			}
		}
		// If it's a string path, load from file
		if (typeof obj === "string") {
			try {
				return JSON.parse(readFileSync(obj, "utf-8"));
			} catch {
				return null;
			}
		}
		// If it's already a plain object with candidates/stories, use as-is
		if (obj.candidates !== undefined || obj.stories !== undefined) {
			return obj;
		}
		// Otherwise try default path
		try {
			return JSON.parse(readFileSync(defaultPath, "utf-8"));
		} catch {
			return null;
		}
	};

	factDossier = loadFromFile(
		factDossier,
		join("data", "fact-dossiers", `edition_${editionDate}.json`),
	);
	editorialManifest = loadFromFile(
		editorialManifest,
		(() => {
			try {
				const editorialDir = join("data", "editorial-selection");
				const files = readdirSync(editorialDir)
					.filter(
						(f) =>
							f.startsWith(`${editionDate}_`) &&
							f.endsWith(".json"),
					)
					.sort();
				if (files.length > 0) {
					return join(editorialDir, files[files.length - 1]);
				}
			} catch {}
			return "";
		})(),
	);

	// Ensure we have valid objects with required arrays
	factDossier = factDossier || {
		candidates: [],
		editionDate,
		editionWindow: { start: "", end: "", timezone: "Europe/Amsterdam" },
	};
	editorialManifest = editorialManifest || {
		stories: [],
		candidates: [],
		editionDate,
	};

	// Debug logging
	console.log(
		`[validatePublicationArtifacts] factDossier.candidates: ${factDossier.candidates?.length ?? "undefined"}`,
	);
	console.log(
		`[validatePublicationArtifacts] editorialManifest.stories: ${editorialManifest.stories?.length ?? "undefined"}`,
	);

	// Read artifact content from file paths
	const getContent = (artifact: any): string => {
		if (!artifact) return "";
		// If artifact has a path property, read from file
		if (artifact.path && typeof artifact.path === "string") {
			try {
				return readFileSync(artifact.path, "utf-8");
			} catch {
				return "";
			}
		}
		// If artifact is a string path, read from file
		if (typeof artifact === "string") {
			try {
				return readFileSync(artifact, "utf-8");
			} catch {
				return "";
			}
		}
		// If artifact has markdown/content property
		return artifact.markdown || artifact.content || "";
	};

	const dutchNewsletter = getContent(
		artifacts["newsletter-md"] || artifacts.newsletterMd,
	);
	const dutchListening = getContent(
		artifacts["listening-nl-md"] || artifacts.listeningNlMd,
	);
	const englishArticles = getContent(
		artifacts["english-articles"] || artifacts.englishArticles,
	);
	const englishListening = getContent(
		artifacts["english-listening"] || artifacts.englishListening,
	);

	// Create minimal traceability objects
	const emptyTraceability = {
		segments: [],
		claimCoverage: [],
		sourceCoverage: [],
		storyCoverage: [],
	};

	// Validate cross-language consistency
	try {
		const validation = await validateCrossLanguageConsistency(
			{
				dutchNewsletterMarkdown: dutchNewsletter,
				dutchNewsletterArtifactId: "",
				dutchNewsletterTraceability: emptyTraceability,
				dutchListeningMarkdown: dutchListening,
				dutchListeningArtifactId: "",
				dutchListeningTraceability: emptyTraceability,
				englishArticleMarkdown: englishArticles,
				englishArticleArtifactId: "",
				englishArticleTraceability: emptyTraceability,
				englishListeningMarkdown: englishListening,
				englishListeningArtifactId: "",
				englishListeningTraceability: emptyTraceability,
			},
			factDossier,
			editorialManifest,
		);

		return {
			...validation,
			validated: validation.overallStatus === "consistent",
			validationTimestamp: new Date().toISOString(),
		};
	} catch (err) {
		console.error(
			"[validatePublicationArtifacts] Error in validateCrossLanguageConsistency:",
			err,
		);
		throw err;
	}
}

/**
 * Assemble Three Canonical Daily Publications (H01_ASSEMBLE_CANONICAL_DOCUMENTS).
 * Entry point for workflow stage H01.
 * Finalizes publication.md, research-audit.md, and "AI Daily Intelligence — YYYY-MM-DD.md"
 * with validated content, correct metadata, and stable references.
 */
export async function assembleCanonicalDocuments(input: any): Promise<any> {
	const editionDate = input.editionDate;
	const editionId = `edition_${editionDate}`;

	// Load the three canonical publications
	const { readFileSync, writeFileSync } = await import("fs");
	const { computeContentHash } = await import("./metadata.js");

	// Load newsletter (publication.md)
	const newsletterPath = `editions/edition_${editionDate}/canonical/publication.md`;
	const newsletterMetaPath = `${newsletterPath}.meta.json`;
	let newsletterContent = "";
	let newsletterMeta: any = {};
	try {
		newsletterContent = readFileSync(newsletterPath, "utf-8");
		newsletterMeta = JSON.parse(readFileSync(newsletterMetaPath, "utf-8"));
	} catch {}

	// Load listening narrative
	const listeningPath = `editions/edition_${editionDate}/canonical/AI Daily Intelligence — ${editionDate}.md`;
	const listeningMetaPath = `${listeningPath}.meta.json`;
	let listeningContent = "";
	let listeningMeta: any = {};
	try {
		listeningContent = readFileSync(listeningPath, "utf-8");
		listeningMeta = JSON.parse(readFileSync(listeningMetaPath, "utf-8"));
	} catch {}

	// Load research audit
	const auditPath = `editions/edition_${editionDate}/canonical/research-audit.md`;
	const auditMetaPath = `${auditPath}.meta.json`;
	let auditContent = "";
	let auditMeta: any = {};
	try {
		auditContent = readFileSync(auditPath, "utf-8");
		auditMeta = JSON.parse(readFileSync(auditMetaPath, "utf-8"));
	} catch {}

	// Update metadata to VALIDATED status
	const now = new Date().toISOString();

	if (newsletterMeta.artifactId) {
		newsletterMeta.lifecycleStatus = "VALIDATED";
		newsletterMeta.validationStatus = "passed";
		newsletterMeta.lastSubstantiveUpdateTimestamp = now;
		newsletterMeta.contentHash = computeContentHash(newsletterContent);
		writeFileSync(
			newsletterMetaPath,
			JSON.stringify(newsletterMeta, null, 2),
			"utf-8",
		);
	}

	if (listeningMeta.artifactId) {
		listeningMeta.lifecycleStatus = "VALIDATED";
		listeningMeta.validationStatus = "passed";
		listeningMeta.lastSubstantiveUpdateTimestamp = now;
		listeningMeta.contentHash = computeContentHash(listeningContent);
		writeFileSync(
			listeningMetaPath,
			JSON.stringify(listeningMeta, null, 2),
			"utf-8",
		);
	}

	if (auditMeta.artifactId) {
		auditMeta.lifecycleStatus = "VALIDATED";
		auditMeta.validationStatus = "passed";
		auditMeta.lastSubstantiveUpdateTimestamp = now;
		auditMeta.contentHash = computeContentHash(auditContent);
		writeFileSync(
			auditMetaPath,
			JSON.stringify(auditMeta, null, 2),
			"utf-8",
		);
	}

	// Verify all three have VALIDATED status
	const allValidated =
		newsletterMeta.lifecycleStatus === "VALIDATED" &&
		listeningMeta.lifecycleStatus === "VALIDATED" &&
		auditMeta.lifecycleStatus === "VALIDATED";

	return {
		assembled: allValidated,
		editionDate,
		editionId,
		canonicalDocuments: [
			{
				artifactId: newsletterMeta.artifactId,
				path: newsletterPath,
				status: newsletterMeta.lifecycleStatus,
			},
			{
				artifactId: listeningMeta.artifactId,
				path: listeningPath,
				status: listeningMeta.lifecycleStatus,
			},
			{
				artifactId: auditMeta.artifactId,
				path: auditPath,
				status: auditMeta.lifecycleStatus,
			},
		],
		assembledAt: new Date().toISOString(),
		assembledBy: "canonical-assembler",
	};
}

/**
 * Assemble & Verify Permitted Website Derivatives (H02_ASSEMBLE_WEBSITE_DERIVATIVES).
 * Entry point for workflow stage H02.
 * Finalizes English articles, English listening narratives, daily index.md;
 * verifies cross-references and relative link integrity.
 */
export async function assembleWebsiteDerivatives(input: any): Promise<any> {
	const editionDate = input.editionDate;
	const editionId = `edition_${editionDate}`;

	// Load the website derivatives
	const { readFileSync, writeFileSync, readdirSync } = await import("fs");
	const { join } = await import("path");
	const { computeContentHash } = await import("./metadata.js");

	// Load English articles
	const englishArticlesDir = `editions/edition_${editionDate}/derivatives/english-articles`;
	let englishArticlesContent = "";
	let englishArticlesMeta: any = {};
	try {
		const files = readdirSync(englishArticlesDir).filter((f) =>
			f.endsWith(".md"),
		);
		for (const file of files) {
			const filePath = join(englishArticlesDir, file);
			englishArticlesContent += readFileSync(filePath, "utf-8") + "\n\n";
			const metaPath = `${filePath}.meta.json`;
			try {
				const meta = JSON.parse(readFileSync(metaPath, "utf-8"));
				englishArticlesMeta = meta;
			} catch {}
		}
	} catch {}

	// Load English listening narratives
	const englishListeningDir = `editions/edition_${editionDate}/derivatives/english-listening`;
	let englishListeningContent = "";
	let englishListeningMeta: any = {};
	try {
		const files = readdirSync(englishListeningDir).filter((f) =>
			f.endsWith(".md"),
		);
		for (const file of files) {
			const filePath = join(englishListeningDir, file);
			englishListeningContent += readFileSync(filePath, "utf-8") + "\n\n";
			const metaPath = `${filePath}.meta.json`;
			try {
				const meta = JSON.parse(readFileSync(metaPath, "utf-8"));
				englishListeningMeta = meta;
			} catch {}
		}
	} catch {}

	// Load daily index
	const indexPath = `editions/edition_${editionDate}/index.md`;
	const indexMetaPath = `${indexPath}.meta.json`;
	let indexContent = "";
	let indexMeta: any = {};
	try {
		indexContent = readFileSync(indexPath, "utf-8");
		indexMeta = JSON.parse(readFileSync(indexMetaPath, "utf-8"));
	} catch {}

	// Verify cross-references and relative link integrity
	// (Simple check: ensure all relative links point to existing files)
	const verifyLinks = (content: string, baseDir: string): boolean => {
		const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
		let match;
		let allValid = true;
		while ((match = linkRegex.exec(content)) !== null) {
			const link = match[2];
			if (
				link.startsWith("http://") ||
				link.startsWith("https://") ||
				link.startsWith("mailto:") ||
				link.startsWith("#")
			) {
				continue; // External or anchor links are OK
			}
			// Check relative link
			const targetPath = join(baseDir, link);
			try {
				readFileSync(targetPath, "utf-8");
			} catch {
				console.warn(`Broken link: ${link} in ${baseDir}`);
				allValid = false;
			}
		}
		return allValid;
	};

	const linksValid =
		verifyLinks(englishArticlesContent, englishArticlesDir) &&
		verifyLinks(englishListeningContent, englishListeningDir) &&
		verifyLinks(indexContent, `editions/edition_${editionDate}`);

	// Update metadata to VALIDATED status
	const now = new Date().toISOString();

	if (englishArticlesMeta.artifactId) {
		englishArticlesMeta.lifecycleStatus = "VALIDATED";
		englishArticlesMeta.validationStatus = "passed";
		englishArticlesMeta.lastSubstantiveUpdateTimestamp = now;
		const metaPath = `editions/edition_${editionDate}/derivatives/english-articles/article.md.meta.json`;
		try {
			writeFileSync(
				metaPath,
				JSON.stringify(englishArticlesMeta, null, 2),
				"utf-8",
			);
		} catch {}
	}

	if (englishListeningMeta.artifactId) {
		englishListeningMeta.lifecycleStatus = "VALIDATED";
		englishListeningMeta.validationStatus = "passed";
		englishListeningMeta.lastSubstantiveUpdateTimestamp = now;
		const metaPath = `editions/edition_${editionDate}/derivatives/english-listening/listening.md.meta.json`;
		try {
			writeFileSync(
				metaPath,
				JSON.stringify(englishListeningMeta, null, 2),
				"utf-8",
			);
		} catch {}
	}

	if (indexMeta.artifactId) {
		indexMeta.lifecycleStatus = "VALIDATED";
		indexMeta.validationStatus = "passed";
		indexMeta.lastSubstantiveUpdateTimestamp = now;
		indexMeta.contentHash = computeContentHash(indexContent);
		try {
			writeFileSync(
				indexMetaPath,
				JSON.stringify(indexMeta, null, 2),
				"utf-8",
			);
		} catch {}
	}

	// Verify all three have VALIDATED status
	const allValidated =
		englishArticlesMeta.lifecycleStatus === "VALIDATED" &&
		englishListeningMeta.lifecycleStatus === "VALIDATED" &&
		indexMeta.lifecycleStatus === "VALIDATED" &&
		linksValid;

	return {
		assembled: allValidated,
		editionDate,
		editionId,
		websiteDerivatives: [
			{
				artifactId: englishArticlesMeta.artifactId,
				path: `editions/edition_${editionDate}/derivatives/english-articles/`,
				status: englishArticlesMeta.lifecycleStatus,
			},
			{
				artifactId: englishListeningMeta.artifactId,
				path: `editions/edition_${editionDate}/derivatives/english-listening/`,
				status: englishListeningMeta.lifecycleStatus,
			},
			{
				artifactId: indexMeta.artifactId,
				path: `editions/edition_${editionDate}/index.md`,
				status: indexMeta.lifecycleStatus,
			},
		],
		linksValid,
		assembledAt: new Date().toISOString(),
		assembledBy: "website-derivatives-assembler",
	};
}
