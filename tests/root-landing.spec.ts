/**
 * Root landing page behaviour.
 *
 * The project root must be a real landing page: no meta refresh, no automatic
 * language redirect, and an explicit English/Dutch choice. This runs against
 * the locally built preview (BASE_URL), so it verifies the change before the
 * production deploy catches up.
 */

import { test, expect } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:4321";

test.describe("Root landing page", () => {
	test("renders a real landing page without an automatic redirect", async ({
		page,
	}) => {
		await page.goto(`${BASE_URL}/`, {
			waitUntil: "networkidle",
			timeout: 30000,
		});

		// No interstitial: no meta refresh and the URL stays on the root.
		await expect(page.locator('meta[http-equiv="refresh"]')).toHaveCount(0);
		await expect(page).toHaveURL(/\/$/);

		// A real page with an explicit language choice.
		await expect(page.locator("h1").first()).toBeVisible();
		const languages = page.locator('nav[aria-label="Choose language"] a');
		await expect(languages.filter({ hasText: "English" })).toBeVisible();
		await expect(languages.filter({ hasText: "Nederlands" })).toBeVisible();
	});
});
