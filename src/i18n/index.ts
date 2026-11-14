/**
 * i18n utilities and exports
 */
import { en } from "./en";
import { nl } from "./nl";

export type Locale = "en" | "nl";
export type TranslationKeys = typeof en;

export const locales: Locale[] = ["en", "nl"];
export const defaultLocale: Locale = "en";

export const translations = {
	en,
	nl,
} as const;

export function getTranslation(locale: Locale): TranslationKeys {
	return translations[locale];
}

export function getLocaleFromPath(pathname: string): Locale {
	const segments = pathname.split("/").filter(Boolean);
	const firstSegment = segments[0];
	if (firstSegment === "en" || firstSegment === "nl") {
		return firstSegment;
	}
	return defaultLocale;
}

export function getPathWithoutLocale(pathname: string): string {
	const segments = pathname.split("/").filter(Boolean);
	if (segments.length > 0 && (segments[0] === "en" || segments[0] === "nl")) {
		const rest = segments.slice(1);
		return rest.length === 0 ? "/" : `/${rest.join("/")}`;
	}
	return pathname;
}

export function localizePath(pathname: string, locale: Locale): string {
	const bare = getPathWithoutLocale(pathname);
	const trimmed = bare === "/" ? "" : bare.replace(/\/+$/, "");
	return `/${locale}${trimmed}/`;
}

export function getAlternateLocales(
	currentPath: string,
): Array<{ lang: Locale; url: string }> {
	return locales.map((locale) => ({
		lang: locale,
		url: localizePath(currentPath, locale),
	}));
}
