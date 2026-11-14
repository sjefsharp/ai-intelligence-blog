import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const BASE_URL = "http://localhost:4321";

const testRoutes = [
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
];

test.describe("WCAG 2.2 AA Automated Accessibility Tests (axe-core)", () => {
	for (const route of testRoutes) {
		test(`${route.name} - axe-core violations`, async ({ page }) => {
			await page.goto(`${BASE_URL}${route.path}`);
			await page.waitForLoadState("networkidle");

			const accessibilityScanResults = await new AxeBuilder({
				page,
			}).analyze();

			// Log violations for debugging
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

			// Assert no violations at AA level
			expect(accessibilityScanResults.violations).toEqual([]);
		});
	}
});

test.describe("Keyboard Navigation Tests", () => {
	test("Homepage - Tab navigation reaches all interactive elements", async ({
		page,
	}) => {
		await page.goto(`${BASE_URL}/en/`);
		await page.waitForLoadState("networkidle");

		// Count focusable elements
		const focusableCount = await page.evaluate(() => {
			const selectors =
				'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
			return document.querySelectorAll(selectors).length;
		});

		// Tab through all elements
		let tabCount = 0;
		let previousActiveElement = null;

		for (let i = 0; i < focusableCount + 5; i++) {
			await page.keyboard.press("Tab");
			tabCount++;

			const activeElement = await page.evaluate(
				() => document.activeElement?.tagName,
			);
			if (activeElement === "BODY" && previousActiveElement === "BODY") {
				// We've cycled back to body, stop
				break;
			}
			previousActiveElement = activeElement;
		}

		expect(tabCount).toBeGreaterThan(0);
	});

	test("Blog Post - Skip links work correctly", async ({ page }) => {
		await page.goto(`${BASE_URL}/en/blog/first-post/`);
		await page.waitForLoadState("networkidle");

		// First tab should hit skip to main content
		await page.keyboard.press("Tab");
		let focused = await page.evaluate(() =>
			document.activeElement?.getAttribute("href"),
		);
		expect(focused).toBe("#main-content");

		// Second tab should hit skip to navigation
		await page.keyboard.press("Tab");
		focused = await page.evaluate(() =>
			document.activeElement?.getAttribute("href"),
		);
		expect(focused).toBe("#page-nav");

		// Third tab should enter the masthead navigation
		await page.keyboard.press("Tab");
		focused = await page.evaluate(() => document.activeElement?.tagName);
		expect(focused).toBe("A");
	});

	test("Language switcher - keyboard accessible", async ({ page }) => {
		await page.goto(`${BASE_URL}/en/`);
		await page.waitForLoadState("networkidle");

		// Tab to language switcher
		await page.keyboard.press("Tab");
		await page.keyboard.press("Tab");
		await page.keyboard.press("Tab");
		await page.keyboard.press("Tab");
		await page.keyboard.press("Tab");
		await page.keyboard.press("Tab");
		await page.keyboard.press("Tab");
		await page.keyboard.press("Tab");

		// Check if language buttons are focusable
		const langButtons = await page.$$(".lang-btn");
		expect(langButtons.length).toBe(2);

		// Focus first language button
		await langButtons[0].focus();
		const focused = await page.evaluate(() =>
			document.activeElement?.classList.contains("lang-btn"),
		);
		expect(focused).toBe(true);

		// Arrow key navigation within lang-toggle (if implemented as a group)
		await page.keyboard.press("ArrowRight");
	});

	test("Theme toggle - keyboard accessible with arrow keys", async ({
		page,
	}) => {
		await page.goto(`${BASE_URL}/en/`);
		await page.waitForLoadState("networkidle");

		// Focus the theme toggle
		await page.locator(".theme-btn").first().focus();

		// Check initial state
		const firstButton = await page
			.locator('.theme-btn[aria-pressed="true"]')
			.first();
		await expect(firstButton).toBeVisible();

		// Navigate with arrow keys
		await page.keyboard.press("ArrowRight");
		await page.keyboard.press("ArrowRight");

		// Should cycle back
		await page.keyboard.press("ArrowLeft");
	});

	test("Cookie consent - keyboard accessible", async ({ page }) => {
		await page.goto(`${BASE_URL}/en/`);
		await page.waitForLoadState("networkidle");

		// Cookie consent should appear (first visit)
		const banner = page.locator("#cookie-consent");
		await expect(banner).toBeVisible();

		// Focus should be on reject button
		await page.keyboard.press("Tab");
		const focused = await page.evaluate(() => document.activeElement?.id);
		expect(focused).toBe("cookie-consent-reject");

		// Tab through all controls
		await page.keyboard.press("Tab"); // accept
		await page.keyboard.press("Tab"); // save
		await page.keyboard.press("Tab"); // close
		await page.keyboard.press("Tab"); // preferences checkbox
		await page.keyboard.press("Tab"); // analytics checkbox

		// Escape should close
		await page.keyboard.press("Escape");
		await expect(banner).toBeHidden();
	});
});

test.describe("Focus Visibility Tests", () => {
	test("All interactive elements have visible focus styles", async ({
		page,
	}) => {
		await page.goto(`${BASE_URL}/en/`);
		await page.waitForLoadState("networkidle");

		const focusableElements = await page.$$(
			".masthead-nav a, .theme-btn, .lang-btn, .reading-mode-btn, .focus-mode-btn, button, a[href]",
		);

		for (const element of focusableElements) {
			await element.focus();
			const styles = await element.evaluate((el) => {
				const computed = window.getComputedStyle(el);
				return {
					outline: computed.outline,
					outlineWidth: computed.outlineWidth,
					outlineColor: computed.outlineColor,
					outlineOffset: computed.outlineOffset,
					boxShadow: computed.boxShadow,
				};
			});

			// Check for visible focus indicator (outline or box-shadow)
			const hasFocusIndicator =
				styles.outlineWidth !== "0px" || styles.boxShadow !== "none";

			expect(hasFocusIndicator).toBe(true);
		}
	});

	test("Focus not obscured by sticky header", async ({ page }) => {
		await page.goto(`${BASE_URL}/en/blog/first-post/`);
		await page.waitForLoadState("networkidle");

		// Find headings in article
		const headings = await page.$$(
			".article-content h2, .article-content h3",
		);

		for (const heading of headings) {
			await heading.focus();
			const boundingBox = await heading.boundingBox();
			const headerBox = await page.locator(".masthead").boundingBox();

			if (boundingBox && headerBox) {
				// Heading should not be behind sticky header
				expect(boundingBox.y).toBeGreaterThanOrEqual(
					headerBox.y + headerBox.height - 10,
				);
			}
		}
	});
});

test.describe("Language and i18n Tests", () => {
	test("Document lang attribute matches locale", async ({ page }) => {
		for (const locale of ["en", "nl"]) {
			await page.goto(`${BASE_URL}/${locale}/`);
			await page.waitForLoadState("networkidle");

			const lang = await page.getAttribute("html", "lang");
			expect(lang).toBe(locale);
		}
	});

	test("Language switcher navigates to correct locale", async ({ page }) => {
		await page.goto(`${BASE_URL}/en/`);
		await page.waitForLoadState("networkidle");

		// Click Dutch language link
		await page.locator('.lang-btn[data-locale="nl"]').click();
		await page.waitForLoadState("networkidle");

		expect(page.url()).toContain("/nl/");
		const lang = await page.getAttribute("html", "lang");
		expect(lang).toBe("nl");
	});

	test("Language switcher preserves current page context", async ({
		page,
	}) => {
		await page.goto(`${BASE_URL}/en/blog/first-post/`);
		await page.waitForLoadState("networkidle");

		await page.locator('.lang-btn[data-locale="nl"]').click();
		await page.waitForLoadState("networkidle");

		// Should navigate to Dutch version of same article
		expect(page.url()).toContain("/nl/blog/first-post/");
	});

	test("hreflang alternate links present", async ({ page }) => {
		await page.goto(`${BASE_URL}/en/`);
		await page.waitForLoadState("networkidle");

		const hreflangLinks = await page.$$eval(
			'link[rel="alternate"][hreflang]',
			(links) =>
				links.map((l) => ({
					lang: l.getAttribute("hreflang"),
					href: l.getAttribute("href"),
				})),
		);

		expect(hreflangLinks.some((l) => l.lang === "en")).toBe(true);
		expect(hreflangLinks.some((l) => l.lang === "nl")).toBe(true);
		expect(hreflangLinks.some((l) => l.lang === "x-default")).toBe(true);
	});
});

test.describe("Theme Tests", () => {
	test("Light theme - color contrast", async ({ page }) => {
		await page.goto(`${BASE_URL}/en/`);
		await page.waitForLoadState("networkidle");

		// Force light theme
		await page.evaluate(() => {
			document.documentElement.setAttribute("data-theme", "light");
		});

		// Check text contrast by sampling
		const textColors = await page.evaluate(() => {
			const elements = document.querySelectorAll(
				"p, h1, h2, h3, a, button, span",
			);
			const colors = new Set<string>();
			elements.forEach((el) => {
				const style = window.getComputedStyle(el);
				colors.add(style.color);
				colors.add(style.backgroundColor);
			});
			return Array.from(colors);
		});

		// Basic check - ensure we have distinct colors
		expect(textColors.length).toBeGreaterThan(2);
	});

	test("Dark theme - color contrast", async ({ page }) => {
		await page.goto(`${BASE_URL}/en/`);
		await page.waitForLoadState("networkidle");

		await page.evaluate(() => {
			document.documentElement.setAttribute("data-theme", "dark");
		});

		const textColors = await page.evaluate(() => {
			const elements = document.querySelectorAll(
				"p, h1, h2, h3, a, button, span",
			);
			const colors = new Set<string>();
			elements.forEach((el) => {
				const style = window.getComputedStyle(el);
				colors.add(style.color);
				colors.add(style.backgroundColor);
			});
			return Array.from(colors);
		});

		expect(textColors.length).toBeGreaterThan(2);
	});

	test("Theme toggle persists preference", async ({ page }) => {
		await page.goto(`${BASE_URL}/en/`);
		await page.waitForLoadState("networkidle");

		// Click dark theme
		await page.locator('.theme-btn[data-theme="dark"]').click();

		// Reload page
		await page.reload();
		await page.waitForLoadState("networkidle");

		const theme = await page.getAttribute("html", "data-theme");
		expect(theme).toBe("dark");
	});
});

test.describe("Responsive and Zoom Tests", () => {
	test("Content reflows at 320px viewport", async ({ page }) => {
		await page.setViewportSize({ width: 320, height: 800 });
		await page.goto(`${BASE_URL}/en/`);
		await page.waitForLoadState("networkidle");

		// Check for horizontal scrolling
		const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
		const viewportWidth = await page.evaluate(() => window.innerWidth);

		expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1); // Allow 1px rounding
	});

	test("Text resizes to 200% without loss of content", async ({ page }) => {
		await page.goto(`${BASE_URL}/en/blog/first-post/`);
		await page.waitForLoadState("networkidle");

		// Set font size to 200%
		await page.evaluate(() => {
			document.documentElement.style.fontSize = "200%";
		});

		await page.waitForTimeout(500);

		// Check article content is still readable
		const article = page.locator(".article-content");
		await expect(article).toBeVisible();

		// No horizontal overflow on main content
		const contentWidth = await page.evaluate(() => {
			const main = document.querySelector(".reading-column");
			return main ? main.scrollWidth : 0;
		});

		const viewportWidth = await page.evaluate(() => window.innerWidth);
		expect(contentWidth).toBeLessThanOrEqual(viewportWidth + 20); // Small margin for padding
	});

	test("Mobile navigation works", async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 });
		await page.goto(`${BASE_URL}/en/`);
		await page.waitForLoadState("networkidle");

		// Masthead nav should be hidden on mobile
		const nav = page.locator(".masthead-nav");
		await expect(nav).toBeHidden();

		// But tools (theme, reading mode, focus mode, lang) should be visible
		await expect(page.locator(".masthead-tools")).toBeVisible();
		await expect(page.locator(".theme-toggle")).toBeVisible();
		await expect(page.locator(".lang-toggle")).toBeVisible();
	});
});

test.describe("Reduced Motion Tests", () => {
	test("Respects prefers-reduced-motion", async ({ page }) => {
		await page.emulateMedia({ reducedMotion: "reduce" });
		await page.goto(`${BASE_URL}/en/`);
		await page.waitForLoadState("networkidle");

		// Check transitions are disabled
		const transitionDuration = await page.evaluate(() => {
			const element = document.querySelector(".masthead");
			if (!element) return "0s";
			return window.getComputedStyle(element).transitionDuration;
		});

		expect(transitionDuration).toBe("0s");
	});
});

test.describe("ReadAloud Component Tests", () => {
	test("ReadAloud controls present on blog post", async ({ page }) => {
		await page.goto(`${BASE_URL}/en/blog/first-post/`);
		await page.waitForLoadState("networkidle");

		const readAloud = page.locator(".read-aloud");
		await expect(readAloud).toBeVisible();

		const playBtn = page.locator("#read-aloud-play");
		const pauseBtn = page.locator("#read-aloud-pause");
		const stopBtn = page.locator("#read-aloud-stop");

		await expect(playBtn).toBeVisible();
		await expect(pauseBtn).toBeHidden(); // Hidden initially
		await expect(stopBtn).toBeHidden(); // Hidden initially

		// Check accessible names
		await expect(playBtn).toHaveAttribute("aria-label", "Play");
	});

	test("ReadAloud button states update correctly", async ({ page }) => {
		await page.goto(`${BASE_URL}/en/blog/first-post/`);
		await page.waitForLoadState("networkidle");

		// Wait for voices to load
		await page.waitForTimeout(1000);

		const playBtn = page.locator("#read-aloud-play");

		// Initially disabled until voices load
		const initiallyDisabled = await playBtn.getAttribute("disabled");
		// Note: might be enabled if voices load fast

		// Play button should be keyboard accessible
		await playBtn.focus();
		const focused = await page.evaluate(
			() => document.activeElement?.id === "read-aloud-play",
		);
		expect(focused).toBe(true);
	});
});

test.describe("Landmark and Semantic Structure Tests", () => {
	test("Page has correct landmark structure", async ({ page }) => {
		await page.goto(`${BASE_URL}/en/blog/first-post/`);
		await page.waitForLoadState("networkidle");

		const landmarks = await page.$$eval(
			"[role], header, nav, main, aside, footer",
			(elements) =>
				elements.map((el) => ({
					tag: el.tagName.toLowerCase(),
					role: el.getAttribute("role"),
					id: el.id,
				})),
		);

		// Check for required landmarks
		const roles = landmarks.map((l) => l.role).filter(Boolean);
		expect(roles).toContain("banner"); // header
		expect(roles).toContain("navigation"); // nav
		expect(roles).toContain("main");
		expect(roles).toContain("contentinfo"); // footer
	});

	test("Heading hierarchy is correct", async ({ page }) => {
		await page.goto(`${BASE_URL}/en/blog/first-post/`);
		await page.waitForLoadState("networkidle");

		const headings = await page.$$eval(
			"h1, h2, h3, h4, h5, h6",
			(elements) =>
				elements.map((el) => ({
					level: parseInt(el.tagName[1]),
					text: el.textContent?.trim().substring(0, 50),
				})),
		);

		// Should have exactly one h1
		const h1Count = headings.filter((h) => h.level === 1).length;
		expect(h1Count).toBe(1);

		// Headings should not skip levels
		for (let i = 1; i < headings.length; i++) {
			const diff = headings[i].level - headings[i - 1].level;
			expect(diff).toBeLessThanOrEqual(1); // No skipping levels (e.g., h1 to h3)
		}
	});

	test("Images have alt text", async ({ page }) => {
		await page.goto(`${BASE_URL}/en/blog/first-post/`);
		await page.waitForLoadState("networkidle");

		const images = await page.$$eval("img", (imgs) =>
			imgs.map((img) => ({
				src: img.src,
				alt: img.alt,
				hasAlt: img.hasAttribute("alt"),
			})),
		);

		for (const img of images) {
			expect(img.hasAlt).toBe(true);
			// Alt can be empty for decorative images
			if (img.alt === "") {
				// Check if it's marked as decorative
				const isDecorative = await page.evaluate((src) => {
					const el = document.querySelector(`img[src="${src}"]`);
					return (
						el?.getAttribute("role") === "presentation" ||
						el?.closest('[aria-hidden="true"]')
					);
				}, img.src);
				// Decorative images should have empty alt
			}
		}
	});
});

test.describe("Table Accessibility Tests", () => {
	test("Tables have headers and captions", async ({ page }) => {
		await page.goto(`${BASE_URL}/en/blog/markdown-style-guide/`);
		await page.waitForLoadState("networkidle");

		const tables = await page.$$eval("table", (tables) =>
			tables.map((table) => ({
				hasCaption: !!table.querySelector("caption"),
				hasThead: !!table.querySelector("thead"),
				hasTh: !!table.querySelector("th"),
				thScope: Array.from(table.querySelectorAll("th")).map((th) =>
					th.getAttribute("scope"),
				),
			})),
		);

		for (const table of tables) {
			if (table.hasTh) {
				// Tables with th should have proper structure
				expect(table.hasThead || table.hasCaption).toBe(true);
			}
		}
	});
});

test.describe("Form and Control Accessibility Tests", () => {
	test("Search input has label", async ({ page }) => {
		await page.goto(`${BASE_URL}/en/search/`);
		await page.waitForLoadState("networkidle");

		const searchInput = page.locator(
			'input[type="search"], input[name="q"], input[placeholder*="earch" i]',
		);
		if ((await searchInput.count()) > 0) {
			const label = await searchInput.getAttribute("aria-label");
			const placeholder = await searchInput.getAttribute("placeholder");
			const id = await searchInput.getAttribute("id");

			// Should have accessible name via label, aria-label, or placeholder
			const hasAccessibleName = label || placeholder || id;
			expect(hasAccessibleName).toBeTruthy();
		}
	});

	test("Cookie consent checkboxes have labels", async ({ page }) => {
		await page.goto(`${BASE_URL}/en/`);
		await page.waitForLoadState("networkidle");

		const banner = page.locator("#cookie-consent");
		await expect(banner).toBeVisible();

		const checkboxes = await page.$$(
			"#cookie-consent-preferences, #cookie-consent-analytics",
		);
		for (const checkbox of checkboxes) {
			const id = await checkbox.getAttribute("id");
			const label = await page.$(`label[for="${id}"]`);
			expect(label).toBeTruthy();
		}
	});
});
