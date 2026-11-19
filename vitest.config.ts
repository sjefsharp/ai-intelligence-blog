import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		include: ["src/**/*.test.ts", "src/**/*.test.ts"],
		exclude: ["node_modules", "dist", ".astro", "tests"],
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html"],
			exclude: [
				"node_modules",
				"dist",
				".astro",
				"tests",
				"**/*.config.*",
				"**/*.d.ts",
			],
			// Current baseline: ~64%. Target: 80%.
			// Set threshold at baseline to prevent regression; raise incrementally.
			thresholds: {
				lines: 64,
				functions: 69,
				branches: 56,
				statements: 63,
			},
		},
	},
});
