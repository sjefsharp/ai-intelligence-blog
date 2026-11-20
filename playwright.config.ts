import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./tests",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	// axe-core analysis takes ~9s per page on this site; 30s is too tight when
	// the preview server is also serving the suite.
	timeout: 90000,
	reporter: "html",
	use: {
		baseURL: "http://localhost:4321",
		trace: "on-first-retry",
		screenshot: "only-on-failure",
	},
	projects: [
		{
			name: "accessibility",
			use: { ...devices["Desktop Chrome"] },
			testMatch: [
				"**/accessibility.spec.ts",
				"**/production-audit.spec.ts",
				"**/root-landing.spec.ts",
			],
		},
		{
			name: "visual-regression",
			use: { ...devices["Desktop Chrome"] },
			testMatch: "**/visual-regression.spec.ts",
		},
		{
			name: "visual-regression-prod",
			use: {
				...devices["Desktop Chrome"],
				baseURL: "https://sjefsharp.github.io/ai-intelligence-blog/",
			},
			testMatch: "**/visual-regression-prod.spec.ts",
		},
	],
	webServer: {
		command: "astro dev --port 4321",
		url: "http://localhost:4321",
		reuseExistingServer: true,
		timeout: 120000,
	},
});
