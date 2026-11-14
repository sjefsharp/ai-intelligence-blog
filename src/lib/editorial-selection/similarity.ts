/**
 * Editorial Selection — Deterministic Text Utilities
 *
 * Small, dependency-free helpers for normalization and similarity. These are
 * deterministic and inspectable: no model reasoning is involved.
 */

/** Normalize a URL for duplicate detection (trailing slash, query order, case). */
export function normalizeUrl(url: string): string {
	try {
		const parsed = new URL(url);
		parsed.hash = "";
		const params = [...parsed.searchParams.entries()]
			.map(([key, value]) => `${key}=${value}`)
			.sort();
		parsed.search = params.length > 0 ? `?${params.join("&")}` : "";
		let pathname = parsed.pathname.replace(/\/+$/, "");
		if (pathname === "") pathname = "/";
		return `${parsed.protocol}//${parsed.host.toLowerCase()}${pathname}${parsed.search}`;
	} catch {
		return url.trim().toLowerCase();
	}
}

/** Lowercase word tokens, dropping punctuation and very short non-numeric tokens. */
export function tokenize(value: string): string[] {
	return value
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\s]/gu, " ")
		.split(/\s+/)
		.filter((token) => token.length > 1 || /\d/.test(token));
}

/** Normalize a statement for exact-comparison purposes. */
export function normalizeStatement(value: string): string {
	return tokenize(value).join(" ");
}
