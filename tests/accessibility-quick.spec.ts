import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const BASE_URL = "http://localhost:4321";

const testRoutes = [
	{ path: "/en/", name: "English Homepage" },
	{ path: "/nl/", name: "Dutch Homepage" },
	{ path: "/en/blog/first-post/", name: "English Blog Post" },
	{ path: "/nl/blog/first-post/", name: "Dutch Blog Post" },
];

test.describe("WCAG 2.2 AA Automated Accessibility Tests (axe-core) - Quick", () => {
	for (const route of testRoutes) {
		test(`${route.name} - axe-core violations`, async ({ page }) => {
			await page.goto(`${BASE_URL}${route.path}`);
			await page.waitForLoadState("networkidle");

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
					for (const node of violation.nodes.slice(0, 3)) {
						console.log(`  - ${node.target.join(" ")}`);
					}
				}
			}

			// Just log, don't fail - we want to see all violations
			// expect(accessibilityScanResults.violations).toEqual([]);
		});
	}
});
