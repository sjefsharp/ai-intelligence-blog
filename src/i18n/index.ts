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
	const locale = getLocaleFromPath(pathname);
	if (locale === defaultLocale) {
		return pathname;
	}
	return pathname.replace(`/${locale}`, "") || "/";
}

export function localizePath(pathname: string, locale: Locale): string {
	const pathWithoutLocale = getPathWithoutLocale(pathname);
	if (locale === defaultLocale) {
		return pathWithoutLocale;
	}
	return `/${locale}${pathWithoutLocale}`;
}

export function getAlternateLocales(
	currentPath: string,
): Array<{ lang: Locale; url: string }> {
	return locales.map((locale) => ({
		lang: locale,
		url: localizePath(currentPath, locale),
	}));
}
