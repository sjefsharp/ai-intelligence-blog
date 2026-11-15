/**
 * Newsletter Generator — Validation Tests
 *
 * ⚠️  All edition, candidate, claim and source data used here is SYNTHETIC
 * FIXTURE DATA from the fact-dossier and editorial-selection fixtures.
 * No test below represents actually retrieved evidence, and no assertion
 * should be read as a real editorial or research finding.
 *
 * These tests validate the newsletter generator output against the
 * publication contract requirements.
 */

import { describe, it, expect } from "vitest";
import type { NewsletterGenerationInput } from "./newsletter-generator.js";

describe("Newsletter Generator — Output Validation", () => {
	const createMockInput = (
		stories: any[] = [],
	): NewsletterGenerationInput => ({
		editionDate: "2025-01-15",
		editionWindow: {
			start: "2025-01-14T05:00:00+01:00[Europe/Amsterdam]",
			end: "2025-01-15T05:00:00+01:00[Europe/Amsterdam]",
			timezone: "Europe/Amsterdam",
		},
		factDossier: {} as NewsletterGenerationInput["factDossier"],
		editorialManifest: {} as NewsletterGenerationInput["editorialManifest"],
		historicalRegression: null,
		stories,
	});

	const validMarkdown = `# AI Intelligence — woensdag 15 januari 2025

## Inleiding

Test intro.

---

## Verhalen

### 1. Test Org — Test Domain

#### Wat is veranderd

Test change.

**Publicatiedatum:** 15 januari 2025 om 10:00 (Europe/Amsterdam).

#### Waarom dit belangrijk is

**Materiële gewicht:** Hoog (score: 0.80).

#### Hoe het werkt

Test mechanism.

#### Beperkingen en tegenbewijs

**Verificatieniveau:** L2 (artefactreproductie).

#### Bronnen

- https://example.com/source

**Claim-specifieke bronnen:**
- https://example.com/claim-source

**Claim-identificaties:** claim_abc123

**Materiële nieuwheid:** STRONG — Temporal eligibility: NEW_PASS; Evidence sufficiency: STRONG

**Diepgang:** diepgang

**Let op:** Some caveat.

---

## Navigatie

- [Research Audit](research-audit.md) — Technisch bewijs en editoriële verantwoording
- [Luisterverhaal](AI Daily Intelligence — 2025-01-15.md) — Volledig Nederlandse luisternarratief

---

*Deze publicatie is gegenereerd vanuit het canoniek feiten dossier en de editoriële selectie manifest. Feitelijke claims zijn traceerbaar naar bronnen via claim-identificaties.*`;

	it("generates valid markdown structure with required sections", async () => {
		const { generateNewsletterMarkdown } =
			await import("./newsletter-generator.js");
		const demoInput = createMockInput([]);
		const markdown = generateNewsletterMarkdown(demoInput);

		expect(markdown).toContain("# AI Intelligence —");
		expect(markdown).toContain("## Inleiding");
		expect(markdown).toContain("## Verhalen");
		expect(markdown).toContain("## Navigatie");
		expect(markdown).toContain("[Research Audit](research-audit.md)");
		expect(markdown).toContain("[Luisterverhaal](");
		expect(markdown).not.toContain("${editionDate}");
	});

	it("validates output correctly", async () => {
		const { validateNewsletterOutput } =
			await import("./newsletter-generator.js");
		const validation = validateNewsletterOutput(
			validMarkdown,
			createMockInput(),
		);
		expect(validation.valid).toBe(true);
		expect(validation.errors).toHaveLength(0);
	});

	it("detects missing required sections", async () => {
		const { validateNewsletterOutput } =
			await import("./newsletter-generator.js");
		const invalidMarkdown = `# AI Intelligence — woensdag 15 januari 2025

Some content without required sections.`;

		const validation = validateNewsletterOutput(
			invalidMarkdown,
			createMockInput(),
		);
		expect(validation.valid).toBe(false);
		expect(validation.errors.length).toBeGreaterThan(0);
	});

	it("detects template variables", async () => {
		const { validateNewsletterOutput } =
			await import("./newsletter-generator.js");
		const markdownWithTemplate = `# AI Intelligence — \${editionDate}

## Inleiding

Test.

---

## Verhalen

---

## Navigatie

*Deze publicatie is gegenereerd vanuit het canoniek feiten dossier en de editoriële selectie manifest.*`;

		const validation = validateNewsletterOutput(
			markdownWithTemplate,
			createMockInput(),
		);
		expect(validation.valid).toBe(false);
		expect(
			validation.errors.some((e) => e.includes("Template variable")),
		).toBe(true);
	});

	it("checks heading hierarchy", async () => {
		const { validateNewsletterOutput } =
			await import("./newsletter-generator.js");
		const markdownWithJump = `# AI Intelligence — woensdag 15 januari 2025

## Inleiding

Test.

---

## Verhalen

##### Level 5 heading directly under level 2

---

## Navigatie

*Disclaimer*`;

		const validation = validateNewsletterOutput(
			markdownWithJump,
			createMockInput(),
		);
		expect(
			validation.warnings.some((w) => w.includes("Heading level jump")),
		).toBe(true);
	});

	it("checks for source URLs", async () => {
		const { validateNewsletterOutput } =
			await import("./newsletter-generator.js");
		const markdownNoUrls = `# AI Intelligence — woensdag 15 januari 2025

## Inleiding

Test.

---

## Verhalen

### 1. Test Org — Test Domain

#### Bronnen

Geen URLs hier.

---

## Navigatie

*Disclaimer*`;

		const validation = validateNewsletterOutput(
			markdownNoUrls,
			createMockInput(),
		);
		expect(validation.warnings.some((w) => w.includes("source URLs"))).toBe(
			true,
		);
	});

	it("accepts evidence sufficiency and temporal keywords", async () => {
		const { validateNewsletterOutput } =
			await import("./newsletter-generator.js");
		const markdownWithSufficiency = `# AI Intelligence — woensdag 15 januari 2025

## Inleiding

Test.

---

## Verhalen

### 1. Test Org — Test Domain

**Materiële nieuwheid:** STRONG — Temporal eligibility: NEW_PASS; Evidence sufficiency: STRONG

---

## Navigatie

*Disclaimer*`;

		const validation = validateNewsletterOutput(
			markdownWithSufficiency,
			createMockInput(),
		);
		expect(
			validation.warnings.some((w) =>
				w.includes("evidence classification"),
			),
		).toBe(false);
	});
});

describe("Newsletter Generator — Helper Functions", () => {
	it("formats edition window correctly", async () => {
		const { formatWindow } = await import("./newsletter-generator.js");

		const result = formatWindow({
			start: "2025-01-14T05:00:00+01:00[Europe/Amsterdam]",
			end: "2025-01-15T05:00:00+01:00[Europe/Amsterdam]",
			timezone: "Europe/Amsterdam",
		});
		expect(result).toContain("05:00");
		expect(result).toContain("Europe/Amsterdam");
	});
});
