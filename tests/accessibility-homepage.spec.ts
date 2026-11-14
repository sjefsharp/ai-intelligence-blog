import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const BASE_URL = "http://localhost:4321";

const homepageRoutes = [
	{ path: "/en/", name: "English Homepage" },
	{ path: "/nl/", name: "Dutch Homepage" },
];

test.describe("WCAG 2.2 AA Automated Accessibility Tests (axe-core) - Homepages Only", () => {
	test.use({ colorScheme: "light" });

	for (const route of homepageRoutes) {
		test(`${route.name} - axe-core violations`, async ({ page }) => {
			await page.goto(`${BASE_URL}${route.path}`, {
				waitUntil: "domcontentloaded",
			});
			await page.waitForTimeout(1000);

			const accessibilityScanResults = await new AxeBuilder({
				page,
			}).analyze();

			if (accessibilityScanResults.violations.length > 0) {
				console.log(`\n=== ${route.name} (${route.path}) ===`);
				for (const violation of accessibilityScanResults.violations) {
					console.log(
						`[${violation.impact}] ${violation.id}: ${violation.description}`,
					);
					console.log(
						`  WCAG: ${violation.tags.filter((t) => t.startsWith("wcag")).join(", ")}`,
					);
					console.log(`  Nodes: ${violation.nodes.length}`);
				}
			}

			expect(accessibilityScanResults.violations).toEqual([]);
		});
	}
});
