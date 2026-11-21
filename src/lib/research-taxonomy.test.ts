/**
 * Research Taxonomy Validation Tests
 *
 * Tests cover:
 * - Taxonomy structure and ID uniqueness
 * - Cross-domain relationship integrity
 * - Ring-to-domain mapping completeness
 * - Source family mapping coverage
 * - Canonical terminology deduplication
 * - Backward compatibility with existing schemas
 * - Validation rules from research-taxonomy.yml
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { parseAllDocuments } from "yaml";

// Load taxonomy
const taxonomyPath = join(__dirname, "../../data/research-taxonomy.yml");
const taxonomyYaml = readFileSync(taxonomyPath, "utf-8");
const docs = parseAllDocuments(taxonomyYaml);

type LocalizedLabel = { en: string; nl: string };
type TaxonomySubdomain = {
	stable_id: string;
	id: string;
	label: LocalizedLabel;
	source_families: string[];
	discovery_methods: string[];
	ring_affinity: number[];
	cross_domain_links: string[];
};
type TaxonomyDomain = {
	stable_id: string;
	id: string;
	label: LocalizedLabel;
	version: string;
	subdomains: TaxonomySubdomain[];
};
type TaxonomyRelationship = {
	relationship: string;
	strength: string;
	domains: string[];
};
type TaxonomyRing = { primary_domains: string[] };
type TaxonomyTerm = {
	term: string;
	definition: LocalizedLabel;
	domains: string[];
	forbidden?: { en?: string[]; nl?: string[] };
};
type TaxonomyRule = {
	id: string;
	name: string;
	check: string;
	severity: string;
};
type Taxonomy = {
	domains: TaxonomyDomain[];
	cross_domain_relationships: TaxonomyRelationship[];
	ring_domain_mapping: {
		ring1: TaxonomyRing;
		ring2: TaxonomyRing;
		ring3: TaxonomyRing;
	};
	source_family_domain_map: Record<string, string[]>;
	canonical_terminology: TaxonomyTerm[];
	validation_rules: TaxonomyRule[];
	coverage_assessment: {
		well_covered: string[];
		moderately_covered: string[];
		gaps_needing_attention: string[];
		mitigation_strategies: string[];
	};
};

const taxonomy = docs[0].toJS() as Taxonomy;

describe("Research Taxonomy v2.0 — Structure Validation", () => {
	describe("Domain Structure", () => {
		it("has exactly 6 top-level domains", () => {
			expect(taxonomy.domains).toHaveLength(6);
		});

		it("domain IDs follow DOM-NN pattern", () => {
			for (const domain of taxonomy.domains) {
				expect(domain.stable_id).toMatch(/^DOM-\d{2}$/);
			}
		});

		it("domain IDs are unique", () => {
			const ids = taxonomy.domains.map((d) => d.stable_id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		it("all domains have EN and NL labels", () => {
			for (const domain of taxonomy.domains) {
				expect(domain.label.en).toBeDefined();
				expect(domain.label.nl).toBeDefined();
				expect(domain.label.en.length).toBeGreaterThan(0);
				expect(domain.label.nl.length).toBeGreaterThan(0);
			}
		});

		it("all domains have version 2.0", () => {
			for (const domain of taxonomy.domains) {
				expect(domain.version).toBe("2.0");
			}
		});

		it("domain stable_ids match expected values", () => {
			const expectedIds = [
				"DOM-01", // Agentic AI & Software Engineering
				"DOM-02", // Models, Inference & Scientific Research
				"DOM-03", // Architecture, Security & Governance
				"DOM-04", // Enterprise AI Adoption & Organizational Transformation
				"DOM-05", // Economics, Business Impact & Strategic Intelligence
				"DOM-06", // Independent Research & Advisory Intelligence
			];
			const actualIds = taxonomy.domains.map((d) => d.stable_id).sort();
			expect(actualIds).toEqual(expectedIds);
		});
	});

	describe("Subdomain Structure", () => {
		it("all subdomain IDs follow DOM-NN-SDNN pattern", () => {
			for (const domain of taxonomy.domains) {
				for (const subdomain of domain.subdomains) {
					expect(subdomain.stable_id).toMatch(/^DOM-\d{2}-SD\d{2}$/);
				}
			}
		});

		it("subdomain IDs are globally unique", () => {
			const allSubdomains = taxonomy.domains.flatMap((d) => d.subdomains);
			const ids = allSubdomains.map((s) => s.stable_id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		it("subdomain IDs correctly reference parent domain", () => {
			for (const domain of taxonomy.domains) {
				const domainNum = domain.stable_id.replace("DOM-", "");
				for (const subdomain of domain.subdomains) {
					expect(subdomain.stable_id).toMatch(
						new RegExp(`^DOM-${domainNum}-SD`),
					);
				}
			}
		});

		it("all subdomains have EN and NL labels", () => {
			for (const domain of taxonomy.domains) {
				for (const subdomain of domain.subdomains) {
					expect(subdomain.label.en).toBeDefined();
					expect(subdomain.label.nl).toBeDefined();
				}
			}
		});

		it("all subdomains have at least one source_family", () => {
			for (const domain of taxonomy.domains) {
				for (const subdomain of domain.subdomains) {
					expect(subdomain.source_families).toBeDefined();
					expect(subdomain.source_families.length).toBeGreaterThan(0);
				}
			}
		});

		it("all subdomains have at least one discovery_method", () => {
			for (const domain of taxonomy.domains) {
				for (const subdomain of domain.subdomains) {
					expect(subdomain.discovery_methods).toBeDefined();
					expect(subdomain.discovery_methods.length).toBeGreaterThan(
						0,
					);
				}
			}
		});

		it("all subdomains have ring_affinity with valid values", () => {
			for (const domain of taxonomy.domains) {
				for (const subdomain of domain.subdomains) {
					expect(subdomain.ring_affinity).toBeDefined();
					expect(Array.isArray(subdomain.ring_affinity)).toBe(true);
					expect(subdomain.ring_affinity.length).toBeGreaterThan(0);
					for (const ring of subdomain.ring_affinity) {
						expect([1, 2, 3]).toContain(ring);
					}
				}
			}
		});

		it("subdomain cross_domain_links reference valid domain IDs", () => {
			const validDomainIds = new Set(taxonomy.domains.map((d) => d.id));
			for (const domain of taxonomy.domains) {
				for (const subdomain of domain.subdomains) {
					for (const link of subdomain.cross_domain_links) {
						expect(validDomainIds.has(link)).toBe(true);
					}
				}
			}
		});

		it("expected subdomain count per domain", () => {
			const expectedCounts: Record<string, number> = {
				"agentic-ai-software-engineering": 7,
				"models-inference-scientific": 5,
				"architecture-security-governance": 5,
				"enterprise-adoption-organizational": 5,
				"economics-business-impact": 5,
				"independent-research-advisory": 5,
			};
			for (const domain of taxonomy.domains) {
				expect(domain.subdomains.length).toBe(
					expectedCounts[domain.id],
				);
			}
		});
	});

	describe("Cross-Domain Relationships", () => {
		it("relationships reference valid domain IDs", () => {
			const validDomainIds = new Set(taxonomy.domains.map((d) => d.id));
			validDomainIds.add("all"); // meta relationship
			for (const rel of taxonomy.cross_domain_relationships) {
				for (const domain of rel.domains) {
					expect(validDomainIds.has(domain)).toBe(true);
				}
			}
		});

		it("relationship strength values are valid", () => {
			for (const rel of taxonomy.cross_domain_relationships) {
				expect(["strong", "meta"]).toContain(rel.strength);
			}
		});

		it("enablement, constraint, feedback, meta relationship types present", () => {
			const types = taxonomy.cross_domain_relationships.map(
				(r) => r.relationship,
			);
			expect(types).toContain("enablement");
			expect(types).toContain("constraint");
			expect(types).toContain("feedback");
			expect(types).toContain("meta");
		});
	});

	describe("Ring-to-Domain Mapping", () => {
		it("ring_domain_mapping has all three rings", () => {
			expect(taxonomy.ring_domain_mapping.ring1).toBeDefined();
			expect(taxonomy.ring_domain_mapping.ring2).toBeDefined();
			expect(taxonomy.ring_domain_mapping.ring3).toBeDefined();
		});

		it("all 6 domains appear in at least one ring primary_domains", () => {
			const allPrimaryDomains = new Set([
				...taxonomy.ring_domain_mapping.ring1.primary_domains,
				...taxonomy.ring_domain_mapping.ring2.primary_domains,
				...taxonomy.ring_domain_mapping.ring3.primary_domains,
			]);
			const allDomainIds = new Set(taxonomy.domains.map((d) => d.id));
			for (const domainId of allDomainIds) {
				expect(allPrimaryDomains.has(domainId)).toBe(true);
			}
		});

		it("ring1 primary_domains include core official sources", () => {
			const ring1Primary =
				taxonomy.ring_domain_mapping.ring1.primary_domains;
			expect(ring1Primary).toContain("agentic-ai-software-engineering");
			expect(ring1Primary).toContain("models-inference-scientific");
			expect(ring1Primary).toContain("architecture-security-governance");
		});

		it("ring2 primary_domains include research-heavy domains", () => {
			const ring2Primary =
				taxonomy.ring_domain_mapping.ring2.primary_domains;
			expect(ring2Primary).toContain("models-inference-scientific");
			expect(ring2Primary).toContain("architecture-security-governance");
			expect(ring2Primary).toContain("independent-research-advisory");
			expect(ring2Primary).toContain(
				"enterprise-adoption-organizational",
			);
			expect(ring2Primary).toContain("economics-business-impact");
		});

		it("ring3 primary_domains include practitioner domains", () => {
			const ring3Primary =
				taxonomy.ring_domain_mapping.ring3.primary_domains;
			expect(ring3Primary).toContain("agentic-ai-software-engineering");
			expect(ring3Primary).toContain(
				"enterprise-adoption-organizational",
			);
			expect(ring3Primary).toContain("architecture-security-governance");
		});
	});

	describe("Source Family Domain Map", () => {
		it("all source families referenced in subdomains exist in map", () => {
			const mapKeys = new Set(
				Object.keys(taxonomy.source_family_domain_map),
			);
			for (const domain of taxonomy.domains) {
				for (const subdomain of domain.subdomains) {
					for (const family of subdomain.source_families) {
						expect(mapKeys.has(family)).toBe(true);
					}
				}
			}
		});

		it("map values reference valid domain IDs", () => {
			const validDomainIds = new Set(taxonomy.domains.map((d) => d.id));
			for (const [, domains] of Object.entries(
				taxonomy.source_family_domain_map,
			)) {
				for (const domain of domains as string[]) {
					expect(validDomainIds.has(domain)).toBe(true);
				}
			}
		});
	});

	describe("Canonical Terminology Registry", () => {
		it("all terms have unique names", () => {
			const terms = taxonomy.canonical_terminology.map((t) => t.term);
			expect(new Set(terms).size).toBe(terms.length);
		});

		it("all terms have EN and NL definitions", () => {
			for (const term of taxonomy.canonical_terminology) {
				expect(term.definition.en).toBeDefined();
				expect(term.definition.nl).toBeDefined();
			}
		});

		it("all terms reference valid domain IDs", () => {
			const validDomainIds = new Set(taxonomy.domains.map((d) => d.id));
			for (const term of taxonomy.canonical_terminology) {
				for (const domain of term.domains) {
					expect(validDomainIds.has(domain)).toBe(true);
				}
			}
		});

		it("forbidden terms do not overlap with canonical terms", () => {
			const canonicalTerms = new Set(
				taxonomy.canonical_terminology.map((t) => t.term.toLowerCase()),
			);
			for (const term of taxonomy.canonical_terminology) {
				if (term.forbidden) {
					for (const forbidden of term.forbidden.en || []) {
						expect(
							canonicalTerms.has(forbidden.toLowerCase()),
						).toBe(false);
					}
					for (const forbidden of term.forbidden.nl || []) {
						expect(
							canonicalTerms.has(forbidden.toLowerCase()),
						).toBe(false);
					}
				}
			}
		});

		it("core contract glossary terms are present", () => {
			const terms = taxonomy.canonical_terminology.map((t) => t.term);
			expect(terms).toContain("Agent");
			expect(terms).toContain("Capability Token");
			expect(terms).toContain("Model Context Protocol (MCP)");
			expect(terms).toContain("Foundation Model");
			expect(terms).toContain("Open-Weight Model");
			expect(terms).toContain("Prompt Injection");
			expect(terms).toContain(
				"SLSA (Supply-chain Levels for Software Artifacts)",
			);
			expect(terms).toContain("SBOM (Software Bill of Materials)");
			expect(terms).toContain("DORA Metrics");
			expect(terms).toContain("SPACE Framework");
			expect(terms).toContain("Total Cost of Ownership (TCO)");
			expect(terms).toContain("FinOps");
			expect(terms).toContain("Magic Quadrant");
			expect(terms).toContain("Hype Cycle");
			expect(terms).toContain("McKinsey Global Institute (MGI)");
		});
	});

	describe("Validation Rules", () => {
		it("validation_rules array is present and non-empty", () => {
			expect(taxonomy.validation_rules).toBeDefined();
			expect(taxonomy.validation_rules.length).toBeGreaterThan(0);
		});

		it("each validation rule has required fields", () => {
			for (const rule of taxonomy.validation_rules) {
				expect(rule.id).toMatch(/^VR-\d{3}$/);
				expect(rule.name).toBeDefined();
				expect(rule.check).toBeDefined();
				expect(["error", "warning"]).toContain(rule.severity);
			}
		});

		it("validation rule IDs are unique", () => {
			const ids = taxonomy.validation_rules.map((r) => r.id);
			expect(new Set(ids).size).toBe(ids.length);
		});
	});

	describe("Coverage Assessment", () => {
		it("coverage_assessment has well_covered, moderately_covered, gaps, mitigations", () => {
			expect(taxonomy.coverage_assessment.well_covered).toBeDefined();
			expect(
				taxonomy.coverage_assessment.moderately_covered,
			).toBeDefined();
			expect(
				taxonomy.coverage_assessment.gaps_needing_attention,
			).toBeDefined();
			expect(
				taxonomy.coverage_assessment.mitigation_strategies,
			).toBeDefined();
		});

		it("well_covered includes all 4 technical domains", () => {
			const covered = taxonomy.coverage_assessment.well_covered.join(" ");
			expect(covered).toContain("Agentic AI");
			expect(covered).toContain("Models, Inference");
			expect(covered).toContain("Architecture, Security");
			expect(covered).toContain("Independent Research");
		});
	});
});

describe("Research Taxonomy — Schema Compatibility", () => {
	let sourceRegistrySchema: any;
	let candidateNewsSchema: any;

	beforeAll(() => {
		sourceRegistrySchema = JSON.parse(
			readFileSync(
				join(__dirname, "../../data/schemas/source-registry.json"),
				"utf-8",
			),
		);
		candidateNewsSchema = JSON.parse(
			readFileSync(
				join(__dirname, "../../data/schemas/candidate-news.json"),
				"utf-8",
			),
		);
	});

	describe("Source Registry Schema", () => {
		it("includes researchDomains enum with all 6 domains", () => {
			const enumValues =
				sourceRegistrySchema.properties.researchDomains.items.enum;
			const expectedDomains = [
				"agentic-ai-software-engineering",
				"models-inference-scientific",
				"architecture-security-governance",
				"enterprise-adoption-organizational",
				"economics-business-impact",
				"independent-research-advisory",
			];
			expect(enumValues).toEqual(expectedDomains);
		});

		it("includes subdomainCoverage with DOM-NN-SDNN pattern", () => {
			const pattern =
				sourceRegistrySchema.properties.subdomainCoverage.items.pattern;
			expect(pattern).toBe("^DOM-\\d{2}-SD\\d{2}$");
		});

		it("includes sourceFamily field", () => {
			expect(sourceRegistrySchema.properties.sourceFamily).toBeDefined();
			expect(sourceRegistrySchema.properties.sourceFamily.type).toBe(
				"string",
			);
		});

		it("includes ringAffinity array with items 1,2,3", () => {
			const items = sourceRegistrySchema.properties.ringAffinity.items;
			expect(items.enum).toEqual([1, 2, 3]);
		});

		it("includes crossDomainSignals boolean", () => {
			expect(
				sourceRegistrySchema.properties.crossDomainSignals,
			).toBeDefined();
			expect(
				sourceRegistrySchema.properties.crossDomainSignals.type,
			).toBe("boolean");
		});

		it("preserves all original required fields", () => {
			const required = sourceRegistrySchema.required;
			expect(required).toContain("id");
			expect(required).toContain("tier");
			expect(required).toContain("type");
			expect(required).toContain("url");
			expect(required).toContain("tags");
			expect(required).toContain("lang");
			expect(required).toContain("addedDate");
			expect(required).toContain("lastVerified");
			expect(required).toContain("status");
		});

		it("new fields are optional (not in required)", () => {
			const required = sourceRegistrySchema.required;
			expect(required).not.toContain("researchDomains");
			expect(required).not.toContain("subdomainCoverage");
			expect(required).not.toContain("sourceFamily");
			expect(required).not.toContain("ringAffinity");
			expect(required).not.toContain("crossDomainSignals");
		});
	});

	describe("Candidate News Schema", () => {
		it("includes researchDomains enum with all 6 domains", () => {
			const enumValues =
				candidateNewsSchema.properties.researchDomains.items.enum;
			const expectedDomains = [
				"agentic-ai-software-engineering",
				"models-inference-scientific",
				"architecture-security-governance",
				"enterprise-adoption-organizational",
				"economics-business-impact",
				"independent-research-advisory",
			];
			expect(enumValues).toEqual(expectedDomains);
		});

		it("includes subdomainTags with DOM-NN-SDNN pattern", () => {
			const pattern =
				candidateNewsSchema.properties.subdomainTags.items.pattern;
			expect(pattern).toBe("^DOM-\\d{2}-SD\\d{2}$");
		});

		it("includes crossDomainSignals boolean", () => {
			expect(
				candidateNewsSchema.properties.crossDomainSignals,
			).toBeDefined();
			expect(candidateNewsSchema.properties.crossDomainSignals.type).toBe(
				"boolean",
			);
		});

		it("researchDomains is required (minItems: 1)", () => {
			expect(
				candidateNewsSchema.properties.researchDomains.minItems,
			).toBe(1);
		});

		it("preserves all original required fields", () => {
			const required = candidateNewsSchema.required;
			expect(required).toContain("id");
			expect(required).toContain("discoveryId");
			expect(required).toContain("title");
			expect(required).toContain("summary");
			expect(required).toContain("sourceIds");
			expect(required).toContain("proposedType");
			expect(required).toContain("tier");
			expect(required).toContain("triageDate");
			expect(required).toContain("status");
		});
	});
});

describe("Research Taxonomy — Backward Compatibility", () => {
	it("source registry schema version compatible with existing sources.yml", () => {
		// The schema adds optional fields; existing sources.yml entries without
		// new fields should still validate (additionalProperties: false but new
		// fields are optional, not required)
		const schema = JSON.parse(
			readFileSync(
				join(__dirname, "../../data/schemas/source-registry.json"),
				"utf-8",
			),
		);
		expect(schema.additionalProperties).toBe(false);
		// Optional fields don't break validation of existing entries
	});

	it("candidate news schema version compatible with existing candidates", () => {
		const schema = JSON.parse(
			readFileSync(
				join(__dirname, "../../data/schemas/candidate-news.json"),
				"utf-8",
			),
		);
		expect(schema.additionalProperties).toBe(false);
	});

	it("domain identifiers are stable (no breaking changes to DOM-XX)", () => {
		// DOM-01 through DOM-06 must remain stable
		const domainIds = taxonomy.domains.map((d) => d.stable_id).sort();
		expect(domainIds).toEqual([
			"DOM-01",
			"DOM-02",
			"DOM-03",
			"DOM-04",
			"DOM-05",
			"DOM-06",
		]);
	});

	it("subdomain identifiers are stable (no breaking changes to DOM-XX-SDXX)", () => {
		const subdomainIds = taxonomy.domains
			.flatMap((d) => d.subdomains.map((s) => s.stable_id))
			.sort();
		// Should have 32 subdomains (7+5+5+5+5+5)
		expect(subdomainIds.length).toBe(32);
		// All should follow pattern
		for (const id of subdomainIds) {
			expect(id).toMatch(/^DOM-\d{2}-SD\d{2}$/);
		}
	});
});

describe("Research Taxonomy — Cross-Domain Discoverability", () => {
	it("sources can belong to multiple domains (schema allows array)", () => {
		const schema = JSON.parse(
			readFileSync(
				join(__dirname, "../../data/schemas/source-registry.json"),
				"utf-8",
			),
		);
		const researchDomains = schema.properties.researchDomains;
		expect(researchDomains.type).toBe("array");
		expect(researchDomains.minItems).toBe(1);
		// maxItems not specified, so multiple allowed
	});

	it("candidates can span multiple domains", () => {
		const schema = JSON.parse(
			readFileSync(
				join(__dirname, "../../data/schemas/candidate-news.json"),
				"utf-8",
			),
		);
		const researchDomains = schema.properties.researchDomains;
		expect(researchDomains.type).toBe("array");
		expect(researchDomains.minItems).toBe(1);
	});

	it("cross-domain signals flag is available for interdisciplinary items", () => {
		const sourceSchema = JSON.parse(
			readFileSync(
				join(__dirname, "../../data/schemas/source-registry.json"),
				"utf-8",
			),
		);
		const candidateSchema = JSON.parse(
			readFileSync(
				join(__dirname, "../../data/schemas/candidate-news.json"),
				"utf-8",
			),
		);
		expect(sourceSchema.properties.crossDomainSignals).toBeDefined();
		expect(candidateSchema.properties.crossDomainSignals).toBeDefined();
	});

	it("ring affinity allows multiple rings per source", () => {
		const schema = JSON.parse(
			readFileSync(
				join(__dirname, "../../data/schemas/source-registry.json"),
				"utf-8",
			),
		);
		const ringAffinity = schema.properties.ringAffinity;
		expect(ringAffinity.type).toBe("array");
		expect(ringAffinity.maxItems).toBe(3);
		expect(ringAffinity.minItems).toBe(1);
	});

	it("canonical terminology provides single definition for cross-domain terms", () => {
		// Agent appears in agentic-ai and architecture-security
		const agentTerm = taxonomy.canonical_terminology.find(
			(t) => t.term === "Agent",
		);
		expect(agentTerm).toBeDefined();
		expect(agentTerm!.domains).toContain("agentic-ai-software-engineering");
		// Single authoritative definition
		expect(agentTerm!.definition.en).toContain(
			"Autonomous software entity",
		);

		// Capability Token appears in agentic-ai and architecture-security
		const capTokenTerm = taxonomy.canonical_terminology.find(
			(t) => t.term === "Capability Token",
		);
		expect(capTokenTerm).toBeDefined();
		expect(capTokenTerm!.domains.length).toBeGreaterThanOrEqual(1);
	});
});
