/**
 * Search index generator for static site search.
 * Generates a JSON index at build time for client-side search.
 */

import type { CollectionEntry } from "astro:content";

export interface SearchIndexEntry {
	id: string;
	title: string;
	description: string;
	content: string;
	tags: string[];
	pubDate: string;
	url: string;
	readingTime: number;
}

export function generateSearchIndex(
	posts: CollectionEntry<"blog">[],
): SearchIndexEntry[] {
	return posts.map((post) => ({
		id: post.id,
		title: post.data.title,
		description: post.data.description,
		content: post.body || "",
		tags: post.data.tags || [],
		pubDate: post.data.pubDate.toISOString(),
		url: `/blog/${post.id}/`,
		readingTime: post.data.readingTime || 0,
	}));
}

export function createSearchIndexFile(
	posts: CollectionEntry<"blog">[],
): string {
	const index = generateSearchIndex(posts);
	return JSON.stringify(index, null, 2);
}
