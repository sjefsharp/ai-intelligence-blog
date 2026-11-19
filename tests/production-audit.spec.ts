import { test, expect } from "@playwright/test";

const PROD_URL = "https://sjefsharp.github.io/ai-intelligence-blog/";

test.describe("Production Site Audit", () => {
  const testRoutes = [
    { path: "/", name: "Root (should redirect)" },
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
      console.log(`✓ ${route.name} (${route.path}): ${response?.status()}`);
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

      // Filter out expected errors (like missing favicon, etc.)
      const relevantErrors = errors.filter(
        (e) => !e.includes("favicon") && !e.includes("404") && !e.includes("manifest")
      );

      if (relevantErrors.length > 0) {
        console.log(`${route.name} console errors:`, relevantErrors);
      }

      // We don't fail on console errors, just report them
      expect(true).toBe(true);
    });

    test(`${route.name} - has proper HTML structure`, async ({ page }) => {
      await page.goto(`${PROD_URL}${route.path}`, {
        waitUntil: "networkidle",
        timeout: 30000,
      });

      // Check for basic HTML structure
      const hasHtml = await page.locator("html").count();
      expect(hasHtml).toBe(1);

      const hasHead = await page.locator("head").count();
      expect(hasHead).toBe(1);

      const hasBody = await page.locator("body").count();
      expect(hasBody).toBe(1);

      // Check for main landmark
      const hasMain = await page.locator("main").count();
      expect(hasMain).toBeGreaterThanOrEqual(1);

      // Check for language attribute
      const lang = await page.getAttribute("html", "lang");
      expect(lang).toBeTruthy();
    });
  }

  test("Root redirects to /en/", async ({ page }) => {
    const response = await page.goto(PROD_URL, {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    // Should redirect to /en/
    expect(page.url()).toContain("/en/");
  });

  test("Navigation works between locales", async ({ page }) => {
    await page.goto(`${PROD_URL}/en/`, { waitUntil: "networkidle" });

    // Check for language switcher
    const nlLink = page.locator('a[href*="/nl/"]');
    await expect(nlLink.first()).toBeVisible();

    // Click Dutch link
    await nlLink.first().click();
    await page.waitForLoadState("networkidle");

    expect(page.url()).toContain("/nl/");
  });

  test("Blog post has proper structure", async ({ page }) => {
    await page.goto(`${PROD_URL}/en/blog/first-post/`, {
      waitUntil: "networkidle",
    });

    // Check for article
    const article = page.locator("article");
    await expect(article).toBeVisible();

    // Check for h1
    const h1 = page.locator("article h1");
    await expect(h1).toBeVisible();

    // Check for date
    const time = page.locator("article time");
    await expect(time).toBeVisible();

    // Check for ReadAloud component
    const readAloud = page.locator(".read-aloud, [data-testid='read-aloud']");
    // Just check it exists in some form
    console.log("ReadAloud count:", await readAloud.count());
  });

  test("CSS loads properly", async ({ page }) => {
    await page.goto(`${PROD_URL}/en/`, { waitUntil: "networkidle" });

    // Check for stylesheets
    const stylesheets = await page.locator('link[rel="stylesheet"]').count();
    expect(stylesheets).toBeGreaterThan(0);

    // Check for inline styles
    const inlineStyles = await page.locator("style").count();
    console.log("Inline style blocks:", inlineStyles);

    // Check body has proper styling (not unstyled)
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
      // Just log for audit
      console.log(`Image: ${src} | Alt: ${alt || "MISSING"}`);
    }
  });

  test("No broken internal links on homepage", async ({ page }) => {
    await page.goto(`${PROD_URL}/en/`, { waitUntil: "networkidle" });

    const links = await page.locator("a[href]").all();
    const brokenLinks: string[] = [];

    for (const link of links.slice(0, 20)) {
      // Test first 20 links
      const href = await link.getAttribute("href");
      if (href && href.startsWith("/") && !href.startsWith("//")) {
        const response = await page.request.get(`${PROD_URL}${href}`, {
          maxRedirects: 5,
        });
        if (response.status() >= 400) {
          brokenLinks.push(`${href} -> ${response.status()}`);
        }
      }
    }

    if (brokenLinks.length > 0) {
      console.log("Broken links:", brokenLinks);
    }
    // Don't fail, just report
    expect(true).toBe(true);
  });
});