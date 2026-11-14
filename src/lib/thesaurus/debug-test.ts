import { TerminologyEntrySchema } from "./schema.js";

const base = {
	entryId: "thes_a1b2c3d4e5f67890",
	canonicalTerm: "Foundation Model",
	originalLanguage: "en",
	preferredTerm: { en: "Foundation Model", nl: "Foundation Model" },
	acronyms: [],
	aliases: {
		en: ["Base Model", "Pre-trained Model"],
		nl: ["Basismodel", "Pre-getraind Model"],
	},
	definition: {
		en: "Large-scale model trained on broad data, adaptable to wide range of downstream tasks",
		nl: "Grootschalig model getraind op brede data, aanpasbaar aan wijd scala downstream taken",
	},
	researchDomains: [
		{ domainId: "models-inference-scientific", primary: true },
		{ domainId: "agentic-ai-software-engineering", primary: false },
	],
	relationships: [],
	sources: [
		{
			sourceId: "arxiv-cs-cl-cs-lg",
			url: "https://arxiv.org/abs/2108.07258",
			title: "On the Opportunities and Risks of Foundation Models",
			tier: 1,
			section: "Abstract",
			accessedAt: "2025-11-10T10:00:00Z",
			retrievalStatus: "CHECKED_FOUND",
			confidence: 0.95,
		},
	],
	evidenceClassification: "RESEARCH_FINDING",
	verificationStatus: "verified",
	verificationConfidence: 0.9,
	standards: ["Stanford HAI Foundation Model Definition"],
	versionApplicability: [],
	forbidden: { en: ["Open Source Model"], nl: ["Open Source Model"] },
	lifecycleStatus: "ESTABLISHED",
	firstObservedAt: "2021-08-16",
	firstVerifiedAt: "2025-11-10",
	lastReviewedAt: "2025-11-10",
	establishedAt: "2025-11-10",
	revisionHistory: [],
	historicalObservations: [
		{
			date: "2021-08-16",
			sourceId: "arxiv-cs-cl-cs-lg",
			sourceUrl: "https://arxiv.org/abs/2108.07258",
			context: "Term coined in Stanford HAI paper",
			confidence: 0.9,
			isFirstObserved: true,
			note: "Original publication",
		},
	],
	schemaVersion: "1.0.0",
	createdAt: "2025-11-10T10:00:00Z",
	updatedAt: "2025-11-10T10:00:00Z",
	createdBy: "thesaurus-engine",
	tags: ["foundational", "ml"],
};

const result = TerminologyEntrySchema.safeParse(base);
console.log("Success:", result.success);
if (!result.success) {
	console.log("Errors:", JSON.stringify(result.error.issues, null, 2));
}
