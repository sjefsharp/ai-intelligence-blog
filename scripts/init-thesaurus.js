// Initialize Thesaurus with Seed Terminology - Plain JavaScript Version

const fs = require("fs").promises;
const path = require("path");
const crypto = require("crypto");

const PROJECT_ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(PROJECT_ROOT, "data");
const THESAURUS_DIR = path.join(DATA_DIR, "thesaurus");
const THESAURUS_MARKDOWN_PATH = path.join(THESAURUS_DIR, "thesaurus.md");

function generateId(prefix) {
	const random = crypto.randomBytes(8).toString("hex");
	return `${prefix}_${random}`;
}

function computeContentHash(content) {
	return `sha256:${crypto.createHash("sha256").update(content, "utf8").digest("hex")}`;
}

function computeObjectHash(obj) {
	const json = JSON.stringify(obj, Object.keys(obj).sort());
	return `sha256:${crypto.createHash("sha256").update(json, "utf8").digest("hex")}`;
}

async function ensureThesaurusDirectories() {
	await fs.mkdir(THESAURUS_DIR, { recursive: true });
	await fs.mkdir(path.join(THESAURUS_DIR, "artifacts"), { recursive: true });
}

function computeThesaurusStats(entries) {
	const byLifecycleStatus = {
		CANDIDATE: 0,
		VERIFIED: 0,
		ESTABLISHED: 0,
		REVISED: 0,
		DEPRECATED: 0,
		SUPERSEDED: 0,
	};
	const byDomain = {};
	let verifiedEntries = 0,
		establishedEntries = 0,
		candidateEntries = 0,
		deprecatedEntries = 0,
		supersededEntries = 0,
		bilingualEntries = 0,
		entriesWithRelationships = 0;

	for (const entry of entries) {
		byLifecycleStatus[entry.lifecycleStatus]++;
		for (const domain of entry.researchDomains) {
			byDomain[domain.domainId] = (byDomain[domain.domainId] || 0) + 1;
		}
		switch (entry.lifecycleStatus) {
			case "VERIFIED":
				verifiedEntries++;
				break;
			case "ESTABLISHED":
				establishedEntries++;
				break;
			case "CANDIDATE":
				candidateEntries++;
				break;
			case "DEPRECATED":
				deprecatedEntries++;
				break;
			case "SUPERSEDED":
				supersededEntries++;
				break;
		}
		if (
			entry.preferredTerm.en.length > 0 &&
			entry.preferredTerm.nl.length > 0 &&
			entry.definition.en.length > 0 &&
			entry.definition.nl.length > 0
		) {
			bilingualEntries++;
		}
		if (entry.relationships.length > 0) entriesWithRelationships++;
	}

	return {
		totalEntries: entries.length,
		byLifecycleStatus,
		byDomain,
		verifiedEntries,
		establishedEntries,
		candidateEntries,
		deprecatedEntries,
		supersededEntries,
		bilingualEntries,
		entriesWithRelationships,
	};
}

async function writeThesaurusMarkdown(entries, options = {}) {
	const {
		title = "AI Intelligence Terminology Thesaurus",
		generatedAt = new Date().toISOString(),
		generatedBy = "thesaurus-engine",
		includeCandidates = true,
		includeDeprecated = true,
	} = options;
	let filteredEntries = entries;
	if (!includeCandidates)
		filteredEntries = filteredEntries.filter(
			(e) => e.lifecycleStatus !== "CANDIDATE",
		);
	if (!includeDeprecated)
		filteredEntries = filteredEntries.filter(
			(e) =>
				e.lifecycleStatus !== "DEPRECATED" &&
				e.lifecycleStatus !== "SUPERSEDED",
		);

	const statusOrder = {
		ESTABLISHED: 0,
		VERIFIED: 1,
		CANDIDATE: 2,
		REVISED: 3,
		DEPRECATED: 4,
		SUPERSEDED: 5,
	};
	filteredEntries.sort((a, b) => {
		const statusDiff =
			statusOrder[a.lifecycleStatus] - statusOrder[b.lifecycleStatus];
		if (statusDiff !== 0) return statusDiff;
		return a.canonicalTerm.localeCompare(b.canonicalTerm);
	});

	const lines = [
		`# ${title}`,
		"",
		`> **Generated:** ${new Date(generatedAt).toLocaleString()} by ${generatedBy}`,
		"> **Schema Version:** 1.0.0",
		`> **Total Entries:** ${filteredEntries.length} (${entries.length} total)`,
		"> **Status:** Persistent knowledge asset — independent of individual news editions",
		"",
		"---",
		"",
		"## Overview",
		"",
		"This thesaurus establishes consistent terminology for AI and software engineering concepts",
		"across daily AI Intelligence editions. It functions as a durable knowledge asset, fully traceable",
		"to authoritative sources, with bilingual (English/Dutch) definitions and validated relationships.",
		"",
		"### Lifecycle Status Legend",
		"",
		"- **ESTABLISHED** — Accepted as part of the canonical terminology register",
		"- **VERIFIED** — Evidence supports the definition; awaiting broader acceptance",
		"- **CANDIDATE** — Proposed but not sufficiently verified",
		"- **REVISED** — Definition updated with traceable justification",
		"- **DEPRECATED** — Historically relevant but no longer preferred",
		"- **SUPERSEDED** — Replaced by another canonical concept",
		"",
		"### Relationship Types",
		"",
		"- **synonym-of** — Equivalent terminology",
		"- **alias-of** — Alternative name for the same concept",
		"- **broader-than** — More general concept",
		"- **narrower-than** — More specific concept",
		"- **related-to** — Relevant conceptual association",
		"- **part-of** — Constituent element of a broader concept",
		"- **extends** — Conceptual extension where substantiated",
		"- **contrasts-with** — Important conceptual distinction",
		"- **supersedes** — Replacement of obsolete terminology",
		"- **conflicts-with** — Documented incompatible definitions",
		"",
		"---",
		"",
		"## Entries",
		"",
	];

	for (const entry of filteredEntries) {
		lines.push(...generateEntryMarkdown(entry));
		lines.push("---", "");
	}

	lines.push("---", "", "## Index by Domain", "");
	const domainGroups = {};
	for (const entry of filteredEntries) {
		for (const domain of entry.researchDomains) {
			if (!domainGroups[domain.domainId])
				domainGroups[domain.domainId] = [];
			domainGroups[domain.domainId].push(entry);
		}
	}
	for (const [domainId, domainEntries] of Object.entries(
		domainGroups,
	).sort()) {
		lines.push(`### ${domainId}`, "");
		for (const entry of domainEntries.sort((a, b) =>
			a.canonicalTerm.localeCompare(b.canonicalTerm),
		)) {
			const statusBadge = `[${entry.lifecycleStatus}]`;
			lines.push(
				`- **${entry.canonicalTerm}** ${statusBadge} (\`${entry.entryId}\`)`,
			);
			if (entry.preferredTerm.nl !== entry.canonicalTerm)
				lines.push(`  - NL: ${entry.preferredTerm.nl}`);
			if (entry.acronyms.length > 0)
				lines.push(
					`  - Acronyms: ${entry.acronyms.map((a) => a.acronym).join(", ")}`,
				);
		}
		lines.push("");
	}

	lines.push("---", "", "## Revision History Summary", "");
	const allRevisions = [];
	for (const entry of entries) {
		for (const rev of entry.revisionHistory) {
			allRevisions.push({
				entryId: entry.entryId,
				entryTerm: entry.canonicalTerm,
				revision: rev,
			});
		}
	}
	allRevisions.sort((a, b) =>
		b.revision.revisedAt.localeCompare(a.revision.revisedAt),
	);
	for (const { entryId, entryTerm, revision } of allRevisions.slice(0, 50)) {
		lines.push(
			`- **${entryTerm}** (\`${entryId}\`) — ${revision.changeType} at ${revision.revisedAt} by ${revision.revisedBy}: ${revision.justification.substring(0, 100)}${revision.justification.length > 100 ? "…" : ""}`,
		);
	}
	if (allRevisions.length > 50)
		lines.push(`- … and ${allRevisions.length - 50} more revisions`);

	await fs.writeFile(THESAURUS_MARKDOWN_PATH, lines.join("\n"), "utf-8");
}

function generateEntryMarkdown(entry) {
	const lines = [];
	const statusBadge = `[${entry.lifecycleStatus}]`;
	lines.push(`### ${entry.canonicalTerm} ${statusBadge}`, "");
	lines.push(`**Entry ID:** \`${entry.entryId}\``, "");
	lines.push("#### Preferred Terms", "");
	lines.push(`- **EN:** ${entry.preferredTerm.en}`);
	lines.push(`- **NL:** ${entry.preferredTerm.nl}`, "");
	lines.push(
		`**Original Language:** ${entry.originalLanguage.toUpperCase()}`,
		"",
	);
	if (entry.acronyms.length > 0) {
		lines.push("#### Acronyms & Abbreviations", "");
		for (const acronym of entry.acronyms) {
			lines.push(`- **${acronym.acronym}**`);
			lines.push(`  - EN: ${acronym.expansion.en}`);
			lines.push(`  - NL: ${acronym.expansion.nl}`);
			if (acronym.context) lines.push(`  - Context: ${acronym.context}`);
			if (acronym.authority)
				lines.push(`  - Authority: ${acronym.authority}`);
		}
		lines.push("");
	}
	const hasAliases =
		(entry.aliases.en?.length ?? 0) > 0 ||
		(entry.aliases.nl?.length ?? 0) > 0;
	if (hasAliases) {
		lines.push("#### Aliases", "");
		if (entry.aliases.en?.length)
			lines.push(`**EN:** ${entry.aliases.en.join(", ")}`);
		if (entry.aliases.nl?.length)
			lines.push(`**NL:** ${entry.aliases.nl.join(", ")}`);
		lines.push("");
	}
	const hasForbidden =
		(entry.forbidden.en?.length ?? 0) > 0 ||
		(entry.forbidden.nl?.length ?? 0) > 0;
	if (hasForbidden) {
		lines.push("#### Forbidden Terms (Do Not Use)", "");
		if (entry.forbidden.en?.length)
			lines.push(`**EN:** ${entry.forbidden.en.join(", ")}`);
		if (entry.forbidden.nl?.length)
			lines.push(`**NL:** ${entry.forbidden.nl.join(", ")}`);
		lines.push("");
	}
	lines.push("#### Definition", "");
	lines.push(`**EN:** ${entry.definition.en}`);
	lines.push(`**NL:** ${entry.definition.nl}`, "");
	lines.push("#### Research Domains", "");
	for (const domain of entry.researchDomains) {
		const primary = domain.primary ? " (primary)" : "";
		const subdomains = domain.subdomainIds?.length
			? ` → ${domain.subdomainIds.join(", ")}`
			: "";
		lines.push(`- ${domain.domainId}${primary}${subdomains}`);
	}
	lines.push("");
	if (entry.relationships.length > 0) {
		lines.push("#### Relationships", "");
		for (const rel of entry.relationships) {
			const typeLabel = formatRelationshipType(rel.type);
			lines.push(`- **${typeLabel}** \`${rel.targetId}\``);
			lines.push(`  - Rationale: ${rel.rationale}`);
			lines.push(`  - Confidence: ${rel.confidence.toFixed(2)}`);
			lines.push(
				`  - Established: ${rel.establishedAt} by ${rel.establishedBy}`,
			);
			if (rel.evidence?.length)
				lines.push(
					`  - Evidence: ${rel.evidence.map((e) => e.url).join("; ")}`,
				);
		}
		lines.push("");
	}
	lines.push("#### Authoritative Sources", "");
	for (const source of entry.sources) {
		lines.push(`- **${source.title}**`);
		lines.push(`  - Source ID: \`${source.sourceId}\``);
		lines.push(`  - URL: ${source.url}`);
		lines.push(`  - Tier: ${source.tier}`);
		if (source.section) lines.push(`  - Section: ${source.section}`);
		lines.push(`  - Accessed: ${source.accessedAt}`);
		lines.push(`  - Retrieval: ${source.retrievalStatus}`);
		lines.push(`  - Confidence: ${source.confidence.toFixed(2)}`);
	}
	lines.push("");
	lines.push("#### Evidence & Verification", "");
	lines.push(`- **Classification:** ${entry.evidenceClassification}`);
	lines.push(`- **Verification Status:** ${entry.verificationStatus}`);
	lines.push(
		`- **Verification Confidence:** ${entry.verificationConfidence.toFixed(2)}`,
		"",
	);
	if (entry.standards.length > 0) {
		lines.push("#### Standards & Specifications", "");
		for (const standard of entry.standards) lines.push(`- ${standard}`);
		lines.push("");
	}
	lines.push("#### Lifecycle", "");
	if (entry.firstObservedAt)
		lines.push(`- **First Observed:** ${entry.firstObservedAt}`);
	lines.push(`- **First Verified:** ${entry.firstVerifiedAt}`);
	lines.push(`- **Last Reviewed:** ${entry.lastReviewedAt}`);
	if (entry.establishedAt)
		lines.push(`- **Established:** ${entry.establishedAt}`);
	if (entry.deprecatedAt)
		lines.push(`- **Deprecated:** ${entry.deprecatedAt}`);
	if (entry.supersededBy)
		lines.push(`- **Superseded By:** \`${entry.supersededBy}\``);
	lines.push("");
	lines.push("#### Metadata", "");
	lines.push(`- **Schema Version:** ${entry.schemaVersion}`);
	lines.push(`- **Created:** ${entry.createdAt} by ${entry.createdBy}`);
	lines.push(`- **Updated:** ${entry.updatedAt}`);
	if (entry.tags.length > 0)
		lines.push(`- **Tags:** ${entry.tags.join(", ")}`);
	lines.push("");
	return lines;
}

function formatRelationshipType(type) {
	const labels = {
		"synonym-of": "Synonym of",
		"alias-of": "Alias of",
		"broader-than": "Broader than",
		"narrower-than": "Narrower than",
		"related-to": "Related to",
		"part-of": "Part of",
		extends: "Extends",
		"contrasts-with": "Contrasts with",
		supersedes: "Supersedes",
		"conflicts-with": "Conflicts with",
	};
	return labels[type] ?? type;
}

// Seed terminology
const seedTerms = [
	{
		canonicalTerm: "Agent",
		originalLanguage: "en",
		preferredTerm: { en: "Agent", nl: "Agent" },
		acronyms: [],
		aliases: {
			en: ["LLM Agent", "Autonomous Agent"],
			nl: ["LLM Agent", "Autonome Agent"],
		},
		definition: {
			en: "Autonomous software entity that plans and executes actions toward a goal using tools",
			nl: "Autonome software-entiteit die plant en acties uitvoert naar een doel met tools",
		},
		researchDomains: [
			{ domainId: "agentic-ai-software-engineering", primary: true },
		],
		relationships: [],
		sources: [
			{
				sourceId: "contract-glossary",
				url: "https://ai-intelligence-blog/schemas/contract-glossary",
				title: "AI Intelligence Publication Contract Glossary",
				tier: 1,
				section: "Glossary",
				accessedAt: new Date().toISOString(),
				retrievalStatus: "CHECKED_FOUND",
				confidence: 1.0,
			},
		],
		evidenceClassification: "VERIFIED_FACT",
		verificationStatus: "verified",
		verificationConfidence: 1.0,
		standards: [],
		versionApplicability: [],
		forbidden: { en: ["Bot", "Chatbot"], nl: ["Bot", "Chatbot"] },
		lifecycleStatus: "ESTABLISHED",
		firstObservedAt: "2023-01-01",
		firstVerifiedAt: new Date().toISOString().split("T")[0],
		lastReviewedAt: new Date().toISOString().split("T")[0],
		establishedAt: new Date().toISOString().split("T")[0],
		revisionHistory: [],
		historicalObservations: [
			{
				date: "2023-01-01",
				sourceId: "contract-glossary",
				sourceUrl:
					"https://ai-intelligence-blog/schemas/contract-glossary",
				context:
					"Term defined in AI Intelligence Publication Contract glossary",
				confidence: 1.0,
				isFirstObserved: true,
				note: "Contract glossary definition",
			},
		],
		schemaVersion: "1.0.0",
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		createdBy: "thesaurus-init",
		tags: ["foundational", "agentic"],
	},
	// Add more terms here as needed
];

async function main() {
	console.log("Initializing thesaurus with seed terminology...");
	await ensureThesaurusDirectories();

	const artifactId = generateId("thesart");
	const now = new Date().toISOString();
	const stats = computeThesaurusStats(seedTerms);

	const artifact = {
		artifactId,
		schemaVersion: "1.0.0",
		editionDate: new Date().toISOString().split("T")[0],
		generatedAt: now,
		generatedBy: "thesaurus-init",
		entries: seedTerms,
		contentHash: "",
		previousVersionHash: undefined,
		stats: computeThesaurusStats(seedTerms),
		validationResults: [],
	};

	const {
		contentHash: _,
		previousVersionHash: __,
		...artifactWithoutHashes
	} = artifact;
	artifact.contentHash = computeObjectHash(artifactWithoutHashes);

	const filename = `${artifact.artifactId}.json`;
	const tempPath = path.join(
		__dirname,
		"..",
		"data",
		"thesaurus",
		"artifacts",
		`.${filename}.tmp`,
	);
	const finalPath = path.join(
		__dirname,
		"..",
		"data",
		"thesaurus",
		"artifacts",
		filename,
	);
	const json = JSON.stringify(artifact, null, 2);
	await fs.writeFile(tempPath, json, "utf-8");
	await fs.rename(tempPath, finalPath);
	console.log(
		`Saved thesaurus artifact: ${artifact.artifactId} with ${seedTerms.length} entries`,
	);

	await writeThesaurusMarkdown(seedTerms, {
		title: "AI Intelligence Terminology Thesaurus",
		generatedAt: now,
		generatedBy: "thesaurus-init",
		includeCandidates: true,
		includeDeprecated: true,
	});
	console.log("Generated thesaurus.md");

	console.log("Thesaurus initialization complete!");
}

main().catch(console.error);
