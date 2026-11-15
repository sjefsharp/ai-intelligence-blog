/**
 * Reading time calculation utility.
 * Estimates reading time based on word count (average 200 words/minute).
 */

export function calculateReadingTime(text: string): number {
	const wordsPerMinute = 200;
	const words = text.trim().split(/\s+/).length;
	const minutes = Math.ceil(words / wordsPerMinute);
	return Math.max(1, minutes);
}

export function formatReadingTime(minutes: number): string {
	if (minutes < 1) return "< 1 min read";
	if (minutes === 1) return "1 min read";
	return `${minutes} min read`;
}

/**
 * Extract plain text from MDX/Markdown content for reading time calculation.
 * Strips frontmatter, code blocks, HTML tags, and markdown syntax.
 */
export function extractPlainText(content: string): string {
	return (
		content
			// Remove frontmatter
			.replace(/^---[\s\S]*?---/, "")
			// Remove code blocks
			.replace(/```[\s\S]*?```/g, "")
			.replace(/`[^`]+`/g, "")
			// Remove HTML tags
			.replace(/<[^>]+>/g, "")
			// Remove markdown images
			.replace(/!\[[^\]]*\]\([^)]+\)/g, "")
			// Remove markdown links but keep text
			.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
			// Remove headings markers
			.replace(/^#{1,6}\s+/gm, "")
			// Remove blockquote markers
			.replace(/^>\s+/gm, "")
			// Remove list markers
			.replace(/^[\s]*[-*+]\s+/gm, "")
			.replace(/^[\s]*\d+\.\s+/gm, "")
			// Remove horizontal rules
			.replace(/^[-*_]{3,}$/gm, "")
			// Remove emphasis markers
			.replace(/\*\*([^*]+)\*\*/g, "$1")
			.replace(/\*([^*]+)\*/g, "$1")
			.replace(/__([^_]+)__/g, "$1")
			.replace(/_([^_]+)_/g, "$1")
			// Remove extra whitespace
			.replace(/\n+/g, " ")
			.replace(/\s+/g, " ")
			.trim()
	);
}
