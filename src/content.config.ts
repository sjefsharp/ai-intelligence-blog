import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const blog = defineCollection({
	// Load Markdown and MDX files in the `src/content/blog/` directory.
	loader: glob({ base: "./src/content/blog", pattern: "**/*.{md,mdx}" }),
	// Type-check frontmatter using a schema
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			// Transform string to Date object
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			heroImage: z.optional(image()),
			// Tags for topic navigation
			tags: z.array(z.string()).default([]),
			// Source link for attribution
			sourceUrl: z.string().url().optional(),
			// Reading time in minutes (calculated at build if not provided)
			readingTime: z.number().int().positive().optional(),
		}),
});

export const collections = { blog };
