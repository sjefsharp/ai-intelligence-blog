import { test, expect } from "@playwright/test";

test.describe("Visual Regression - Production", () => {
	const PROD_URL = "https://sjefsharp.github.io/ai-intelligence-blog/";

	const testRoutes = [
		{ path: "/", name: "root-redirect" },
		{ path: "/en/", name: "en-homepage" },
		{ path: "/nl/", name: "nl-homepage" },
		{ path: "/en/blog/", name: "en-blog-index" },
		{ path: "/nl/blog/", name: "nl-blog-index" },
		{ path: "/en/blog/first-post/", name: "en-blog-post" },
		{ path: "/nl/blog/first-post/", name: "nl-blog-post" },
		{ path: "/en/about/", name: "en-about" },
		{ path: "/nl/about/", name: "nl-about" },
		{ path: "/en/search/", name: "en-search" },
		{ path: "/nl/search/", name: "nl-search" },
		{ path: "/en/topics/", name: "en-topics" },
		{ path: "/nl/topics/", name: "nl-topics" },
		{ path: "/en/editions/", name: "en-editions" },
		{ path: "/nl/editions/", name: "nl-editions" },
	];

	for (const route of testRoutes) {
		test(`${route.name} - visual snapshot`, async ({ page }) => {
			await page.goto(`${PROD_URL}${route.path}`, {
				waitUntil: "networkidle",
				timeout: 30000,
			});

			await page.waitForLoadState("networkidle");
			await page.waitForTimeout(1000);

			await expect(page).toHaveScreenshot(`${route.name}.png`, {
				fullPage: true,
				animations: "disabled",
				threshold: 0.2,
			});
		});
	}

	test("blog post - visual snapshot with read-aloud", async ({ page }) => {
		await page.goto(`${PROD_URL}/en/blog/first-post/`, {
			waitUntil: "networkidle",
			timeout: 30000,
		});

		await page.waitForLoadState("networkidle");
		await page.waitForTimeout(1000);

		const readAloud = page.locator(
			".read-aloud, [data-testid='read-aloud']",
		);
		await expect(readAloud.first()).toBeVisible();

		await expect(page).toHaveScreenshot("en-blog-post-with-readaloud.png", {
			fullPage: true,
			animations: "disabled",
			threshold: 0.2,
		});
	});

	test("homepage - visual snapshot of hero section", async ({ page }) => {
		await page.goto(`${PROD_URL}/en/`, {
			waitUntil: "networkidle",
			timeout: 30000,
		});

		await page.waitForLoadState("networkidle");
		await page.waitForTimeout(1000);

		await expect(page.locator("main")).toHaveScreenshot(
			"en-homepage-hero.png",
			{
				animations: "disabled",
				threshold: 0.2,
			},
		);
	});

	test("navigation - visual snapshot of language switcher", async ({
		page,
	}) => {
		await page.goto(`${PROD_URL}/en/`, {
			waitUntil: "networkidle",
			timeout: 30000,
		});

		await page.waitForLoadState("networkidle");
		await page.waitForTimeout(1000);

		await expect(page.locator("header.masthead")).toHaveScreenshot(
			"en-header.png",
			{
				animations: "disabled",
				threshold: 0.2,
			},
		);
	});
});
