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
