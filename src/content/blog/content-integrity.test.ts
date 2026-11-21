/**
 * Content integrity guard for the public essay collection.
 *
 * Placeholder example posts were removed from public discovery. These tests
 * fail if a post reintroduces a placeholder or example domain as evidence, or
 * if the collection ever becomes empty.
 */

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const contentDir = join(dirname(fileURLToPath(import.meta.url)));

const posts = readdirSync(contentDir).filter((file) =>
	/\.(md|mdx)$/.test(file),
);

const PLACEHOLDER_SOURCE = /(example\.(com|org|net)|github\.com\/example\/)/i;

describe("public essay content", () => {
	it("publishes at least one essay", () => {
		expect(posts.length).toBeGreaterThan(0);
	});

	it("never cites a placeholder domain as a source", () => {
		for (const file of posts) {
			const frontmatter = readFileSync(join(contentDir, file), "utf8");
			const sourceUrl = frontmatter.match(
				/^sourceUrl:\s*["']?([^"'\s]+)["']?/m,
			)?.[1];
			if (sourceUrl) {
				expect(
					PLACEHOLDER_SOURCE.test(sourceUrl),
					`${file} cites placeholder source ${sourceUrl}`,
				).toBe(false);
			}
		}
	});
});
