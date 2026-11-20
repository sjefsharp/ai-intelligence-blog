// @ts-check

import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { defineConfig, fontProviders } from "astro/config";

// https://astro.build/config
export default defineConfig({
	site: "https://sjefsharp.github.io",
	// GitHub Pages serves this project site under /ai-intelligence-blog/.
	// Local dev/preview and CI builds default to "/" so the Playwright harness
	// can keep using root-relative routes; the deploy workflow sets SITE_BASE
	// to the project path for the production artifact.
	base: process.env.SITE_BASE ?? "/",
	integrations: [
		mdx({
			shikiConfig: {
				theme: "github-dark",
				// Override specific token colors for better contrast
				themes: {
					light: "github-light",
					"github-dark": {
						colors: {
							"editor.background": "#1E1E1E",
						},
						tokenColors: [
							{
								scope: "comment",
								settings: { foreground: "#9CA3AF" }, // Lighter gray for comments
							},
							{
								scope: "punctuation",
								settings: { foreground: "#D1D5DB" },
							},
							{
								scope: "string",
								settings: { foreground: "#A5D6FF" },
							},
							{
								scope: "keyword",
								settings: { foreground: "#FF7B72" },
							},
							{
								scope: "function",
								settings: { foreground: "#D2A8FF" },
							},
							{
								scope: "variable",
								settings: { foreground: "#79C0FF" },
							},
							{
								scope: "constant",
								settings: { foreground: "#FFAB70" },
							},
							{
								scope: "number",
								settings: { foreground: "#FFAB70" },
							},
							{
								scope: "tag",
								settings: { foreground: "#FF7B72" },
							},
							{
								scope: "attribute.name",
								settings: { foreground: "#79C0FF" },
							},
							{
								scope: "attribute.value",
								settings: { foreground: "#A5D6FF" },
							},
						],
					},
				},
			},
		}),
		sitemap(),
	],
	markdown: {
		shikiConfig: {
			theme: "github-dark",
			themes: {
				light: "github-light",
				"github-light": {
					colors: {
						"editor.background": "#FFFFFF",
					},
					tokenColors: [
						{
							scope: "comment",
							settings: { foreground: "#6A737D" }, // Medium gray works on both light and dark
						},
						{
							scope: "punctuation",
							settings: { foreground: "#24292E" },
						},
						{
							scope: "string",
							settings: { foreground: "#032F62" },
						},
						{
							scope: "keyword",
							settings: { foreground: "#CF222E" }, // Darker red for keywords
						},
						{
							scope: "function",
							settings: { foreground: "#6F42C1" },
						},
						{
							scope: "variable",
							settings: { foreground: "#E36209" },
						},
						{
							scope: "constant",
							settings: { foreground: "#005CC5" },
						},
						{
							scope: "number",
							settings: { foreground: "#005CC5" },
						},
						{
							scope: "tag",
							settings: { foreground: "#CF222E" },
						},
						{
							scope: "attribute.name",
							settings: { foreground: "#005CC5" },
						},
						{
							scope: "attribute.value",
							settings: { foreground: "#032F62" },
						},
					],
				},
				"github-dark": {
					colors: {
						"editor.background": "#1E1E1E",
					},
					tokenColors: [
						{
							scope: "comment",
							settings: { foreground: "#6A737D" }, // Medium gray works on both light and dark
						},
						{
							scope: "punctuation",
							settings: { foreground: "#D1D5DB" },
						},
						{
							scope: "string",
							settings: { foreground: "#A5D6FF" },
						},
						{
							scope: "keyword",
							settings: { foreground: "#FF7B72" },
						},
						{
							scope: "function",
							settings: { foreground: "#D2A8FF" },
						},
						{
							scope: "variable",
							settings: { foreground: "#79C0FF" },
						},
						{
							scope: "constant",
							settings: { foreground: "#FFAB70" },
						},
						{
							scope: "number",
							settings: { foreground: "#FFAB70" },
						},
						{
							scope: "tag",
							settings: { foreground: "#FF7B72" },
						},
						{
							scope: "attribute.name",
							settings: { foreground: "#79C0FF" },
						},
						{
							scope: "attribute.value",
							settings: { foreground: "#A5D6FF" },
						},
					],
				},
			},
		},
	},
	i18n: {
		defaultLocale: "en",
		locales: ["en", "nl"],
		routing: {
			prefixDefaultLocale: true, // /en/ and /nl/ prefixes
		},
	},
	fonts: [
		{
			provider: fontProviders.local(),
			name: "Atkinson",
			cssVariable: "--font-atkinson",
			fallbacks: ["sans-serif"],
			options: {
				variants: [
					{
						src: ["./src/assets/fonts/atkinson-regular.woff"],
						weight: 400,
						style: "normal",
						display: "swap",
					},
					{
						src: ["./src/assets/fonts/atkinson-bold.woff"],
						weight: 700,
						style: "normal",
						display: "swap",
					},
				],
			},
		},
		{
			provider: fontProviders.local(),
			name: "JetBrains Mono",
			cssVariable: "--font-jetbrains-mono",
			fallbacks: ["monospace"],
			options: {
				variants: [
					{
						src: ["./src/assets/fonts/JetBrainsMono-Regular.ttf"],
						weight: 400,
						style: "normal",
						display: "swap",
					},
					{
						src: ["./src/assets/fonts/JetBrainsMono-Bold.ttf"],
						weight: 700,
						style: "normal",
						display: "swap",
					},
				],
			},
		},
	],
});
