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
	},
	projects: [
		{
			name: "accessibility",
			use: { ...devices["Desktop Chrome"] },
			testMatch: "**/*.spec.ts",
		},
	],
	webServer: {
		command: "astro dev --port 4321",
		url: "http://localhost:4321",
		reuseExistingServer: true,
		timeout: 120000,
	},
});
