import { test } from "@playwright/test";

const BASE_URL = "http://localhost:4321";

test.describe("Landmark Analysis", () => {
	test("Check landmark roles on homepage", async ({ page }) => {
		await page.goto(`${BASE_URL}/en/`);
		await page.waitForLoadState("networkidle");

		const landmarks = await page.evaluate(() => {
			const elements = document.querySelectorAll(
				'[role="banner"], [role="contentinfo"], header, footer, main, nav, aside, article, section',
			);
			return Array.from(elements).map((el) => ({
				tag: el.tagName.toLowerCase(),
				role: el.getAttribute("role"),
				implicitRole:
					el.tagName.toLowerCase() === "header"
						? "banner"
						: el.tagName.toLowerCase() === "footer"
							? "contentinfo"
							: el.tagName.toLowerCase() === "main"
								? "main"
								: el.tagName.toLowerCase() === "nav"
									? "navigation"
									: el.tagName.toLowerCase() === "aside"
										? "complementary"
										: el.tagName.toLowerCase() === "article"
											? "article"
											: null,
				class: el.className,
				id: el.id,
			}));
		});

		console.log(
			"Landmarks on homepage:",
			JSON.stringify(landmarks, null, 2),
		);
	});

	test("Check landmark roles on blog post", async ({ page }) => {
		await page.goto(`${BASE_URL}/en/blog/markdown-style-guide/`);
		await page.waitForLoadState("networkidle");

		const landmarks = await page.evaluate(() => {
			const elements = document.querySelectorAll(
				'[role="banner"], [role="contentinfo"], header, footer, main, nav, aside, article, section',
			);
			return Array.from(elements).map((el) => ({
				tag: el.tagName.toLowerCase(),
				role: el.getAttribute("role"),
				implicitRole:
					el.tagName.toLowerCase() === "header"
						? "banner"
						: el.tagName.toLowerCase() === "footer"
							? "contentinfo"
							: el.tagName.toLowerCase() === "main"
								? "main"
								: el.tagName.toLowerCase() === "nav"
									? "navigation"
									: el.tagName.toLowerCase() === "aside"
										? "complementary"
										: el.tagName.toLowerCase() === "article"
											? "article"
											: null,
				class: el.className,
				id: el.id,
			}));
		});

		console.log(
			"Landmarks on blog post:",
			JSON.stringify(landmarks, null, 2),
		);
	});
});
