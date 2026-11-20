import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		include: ["src/**/*.test.ts"],
		exclude: ["node_modules", "dist", ".astro", "tests"],
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html"],
			// Ratcheted baseline (measured 2026-11-20: 64% statements / 57% branches
			// / 69% functions / 64% lines). Raise incrementally; never lower.
			thresholds: {
				statements: 63,
				branches: 56,
				functions: 68,
				lines: 63,
			},
			exclude: [
				"node_modules",
				"dist",
				".astro",
				"tests",
				"**/*.config.*",
				"**/*.d.ts",
			],
		},
	},
});
