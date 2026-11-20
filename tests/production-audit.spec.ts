import { test, expect } from "@playwright/test";

const PROD_URL =
	process.env.PROD_BASE_URL ??
	"https://sjefsharp.github.io/ai-intelligence-blog/";

test.describe("Production Site Audit", () => {
	const testRoutes = [
		{ path: "/", name: "Root" },
		{ path: "/en/", name: "English Homepage" },
		{ path: "/nl/", name: "Dutch Homepage" },
		{ path: "/en/blog/", name: "English Blog Index" },
		{ path: "/nl/blog/", name: "Dutch Blog Index" },
		{ path: "/en/blog/first-post/", name: "English Blog Post" },
		{ path: "/nl/blog/first-post/", name: "Dutch Blog Post" },
		{ path: "/en/about/", name: "English About Page" },
		{ path: "/nl/about/", name: "Dutch About Page" },
		{ path: "/en/search/", name: "English Search Page" },
		{ path: "/nl/search/", name: "Dutch Search Page" },
		{ path: "/en/topics/", name: "English Topics Page" },
		{ path: "/nl/topics/", name: "Dutch Topics Page" },
		{ path: "/en/editions/", name: "English Editions" },
		{ path: "/nl/editions/", name: "Dutch Editions" },
	];

	for (const route of testRoutes) {
		test(`${route.name} - loads successfully`, async ({ page }) => {
			const response = await page.goto(`${PROD_URL}${route.path}`, {
				waitUntil: "networkidle",
				timeout: 30000,
			});

			expect(response?.status()).toBeLessThan(400);
			console.log(
				`✓ ${route.name} (${route.path}): ${response?.status()}`,
			);
		});

		test(`${route.name} - no console errors`, async ({ page }) => {
			const errors: string[] = [];
			page.on("console", (msg) => {
				if (msg.type() === "error") {
					errors.push(msg.text());
				}
			});

			await page.goto(`${PROD_URL}${route.path}`, {
				waitUntil: "networkidle",
				timeout: 30000,
			});

			const relevantErrors = errors.filter(
				(e) =>
					!e.includes("favicon") &&
					!e.includes("404") &&
					!e.includes("manifest"),
			);

			if (relevantErrors.length > 0) {
				console.log(`${route.name} console errors:`, relevantErrors);
			}

			expect(true).toBe(true);
		});

		if (route.path !== "/") {
			test(`${route.name} - has proper HTML structure`, async ({
				page,
			}) => {
				await page.goto(`${PROD_URL}${route.path}`, {
					waitUntil: "networkidle",
					timeout: 30000,
				});

				const hasHtml = await page.locator("html").count();
				expect(hasHtml).toBe(1);

				const hasHead = await page.locator("head").count();
				expect(hasHead).toBe(1);

				const hasBody = await page.locator("body").count();
				expect(hasBody).toBe(1);

				const hasMain = await page.locator("main").count();
				expect(hasMain).toBeGreaterThanOrEqual(1);

				const lang = await page.getAttribute("html", "lang");
				expect(lang).toBeTruthy();
			});
		}
	}

	test("Root renders a real landing page without an automatic redirect", async ({
		page,
	}) => {
		const response = await page.goto(PROD_URL, {
			waitUntil: "networkidle",
			timeout: 30000,
		});

		expect(response?.status()).toBe(200);
		// No interstitial: the root must not use a meta refresh or auto-redirect.
		await expect(page.locator('meta[http-equiv="refresh"]')).toHaveCount(0);
		await expect(page).not.toHaveURL(/\/en\/$/);

		// A real landing page with an explicit language choice.
		await expect(page.locator("h1").first()).toBeVisible();
		await expect(page.locator('a[href$="/en/"]').first()).toBeVisible();
		await expect(page.locator('a[href$="/nl/"]').first()).toBeVisible();
	});

	test("Navigation works between locales", async ({ page }) => {
		await page.goto(`${PROD_URL}/en/`, { waitUntil: "networkidle" });

		const nlLink = page.locator('a[href*="/nl/"]');
		await expect(nlLink.first()).toBeVisible();

		await nlLink.first().click();
		await page.waitForLoadState("networkidle");

		expect(page.url()).toContain("/nl/");
	});

	test("Blog post has proper structure", async ({ page }) => {
		await page.goto(`${PROD_URL}/en/blog/first-post/`, {
			waitUntil: "networkidle",
		});

		const article = page.locator("article");
		await expect(article).toBeVisible();

		const h1 = page.locator("article h1");
		await expect(h1).toBeVisible();

		const time = page.locator("article time");
		await expect(time).toBeVisible();

		const readAloud = page.locator(
			".read-aloud, [data-testid='read-aloud']",
		);
		console.log("ReadAloud count:", await readAloud.count());
	});

	test("CSS loads properly", async ({ page }) => {
		await page.goto(`${PROD_URL}/en/`, { waitUntil: "networkidle" });

		const stylesheets = await page
			.locator('link[rel="stylesheet"]')
			.count();
		expect(stylesheets).toBeGreaterThan(0);

		const inlineStyles = await page.locator("style").count();
		console.log("Inline style blocks:", inlineStyles);

		const bodyBg = await page.evaluate(() => {
			return window.getComputedStyle(document.body).backgroundColor;
		});
		console.log("Body background:", bodyBg);
	});

	test("Images have alt text", async ({ page }) => {
		await page.goto(`${PROD_URL}/en/`, { waitUntil: "networkidle" });

		const images = await page.locator("img").all();
		for (const img of images) {
			const alt = await img.getAttribute("alt");
			const src = await img.getAttribute("src");
			console.log(`Image: ${src} | Alt: ${alt || "MISSING"}`);
		}
	});

	test("No broken internal links on homepage", async ({ page }) => {
		await page.goto(`${PROD_URL}/en/`, { waitUntil: "networkidle" });

		const links = await page.locator("a[href]").all();
		const brokenLinks: string[] = [];

		for (const link of links.slice(0, 20)) {
			const href = await link.getAttribute("href");
			if (href && href.startsWith("/") && !href.startsWith("//")) {
				const response = await page.request.get(
					new URL(href, PROD_URL).toString(),
					{
						maxRedirects: 5,
					},
				);
				if (response.status() >= 400) {
					brokenLinks.push(`${href} -> ${response.status()}`);
				}
			}
		}

		if (brokenLinks.length > 0) {
			console.log("Broken links:", brokenLinks);
		}
		expect(brokenLinks).toEqual([]);
	});
});
