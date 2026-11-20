/**
 * i18n URL helpers — deployed-base regression tests.
 *
 * The production site is served under `/ai-intelligence-blog/`. Internal links,
 * redirects and alternate-locale URLs must be prefixed with that base; otherwise
 * they resolve against the GitHub Pages origin and 404.
 */

import { describe, it, expect, afterEach, vi } from "vitest";

import {
	withBase,
	localizePath,
	getPathWithoutLocale,
	getAlternateLocales,
} from "./index.js";

describe("i18n base path helpers", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("prefixes root-absolute paths with the deployed base", () => {
		vi.stubEnv("BASE_URL", "/ai-intelligence-blog/");
		expect(withBase("/en/blog")).toBe("/ai-intelligence-blog/en/blog");
	});

	it("defaults to the root when no base is configured", () => {
		vi.stubEnv("BASE_URL", "/");
		expect(withBase("/en/blog")).toBe("/en/blog");
	});

	it("strips the base before removing the locale prefix", () => {
		vi.stubEnv("BASE_URL", "/ai-intelligence-blog/");
		expect(getPathWithoutLocale("/ai-intelligence-blog/en/blog/")).toBe(
			"/blog",
		);
	});

	it("localizes a path under the base", () => {
		vi.stubEnv("BASE_URL", "/ai-intelligence-blog/");
		expect(localizePath("/ai-intelligence-blog/en/blog/", "nl")).toBe(
			"/ai-intelligence-blog/nl/blog/",
		);
	});

	it("builds alternate locale URLs under the base", () => {
		vi.stubEnv("BASE_URL", "/ai-intelligence-blog/");
		expect(getAlternateLocales("/ai-intelligence-blog/en/blog/")).toEqual([
			{ lang: "en", url: "/ai-intelligence-blog/en/blog/" },
			{ lang: "nl", url: "/ai-intelligence-blog/nl/blog/" },
		]);
	});
});
