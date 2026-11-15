/**
 * English translations for AI Intelligence Blog
 */
export const en = {
	// Site
	siteTitle: "AI Intelligence Blog",
	siteDescription:
		"Architectural reasoning for AI-intensive systems. Evidence-first. ADHD-friendly by structure. Written by a system architect for system architects.",

	// Navigation
	nav: {
		home: "Home",
		essays: "Essays",
		topics: "Topics",
		search: "Search",
		about: "About",
	},

	// Language switcher
	lang: {
		label: "Language",
		en: "English",
		nl: "Dutch",
		switchTo: "Switch to {lang}",
		current: "Current language: {lang}",
	},

	// Theme switcher
	theme: {
		label: "Theme",
		system: "System",
		light: "Light",
		dark: "Dark",
		switchTo: "Switch to {theme} theme",
		current: "Current theme: {theme}",
	},

	// Article meta
	meta: {
		readTime: "{time} min read",
		updated: "Updated on {date}",
		published: "Published on {date}",
		source: "Source",
		tags: "Tags",
		by: "By",
	},

	// UI elements
	ui: {
		searchPlaceholder: "Search articles, patterns, decisions…",
		searchResults: "Search results",
		noResults: "No results found. Try different keywords.",
		recentArticles: "Recent articles",
		viewAll: "View all {count} →",
		viewAllEssays: "View all essays →",
		viewAllTopics: "View all topics →",
		onThisPage: "On this page",
		references: "References",
		aboutThisPublication: "About this publication",
		patternCatalog: "Pattern catalog",
		latestEssays: "Latest essays",
		moreTopics: "More topics",
		articlesTagged: 'articles tagged with "{tag}"',
		articleTagged: 'article tagged with "{tag}"',
		noArticlesForTopic: "No articles found for this topic.",
		loading: "Loading…",
		keyFindings: "Key Findings",
		clickToExpand: "Click to expand",
		fontSize: "Font Size",
		lineHeight: "Line Height",
		columnWidth: "Column Width",
		readingMode: "Reading Mode",
		readingModeSettings: "Reading Settings",
		focusMode: "Focus Mode",
		exitFocus: "Exit Focus",
		increase: "Increase",
		decrease: "Decrease",
		resetToDefaults: "Reset to defaults",
		close: "Close",
		readAloud: {
			label: "Read aloud",
			controls: "Playback controls",
			play: "Play",
			pause: "Pause",
			resume: "Resume",
			stop: "Stop",
			progress: "Reading progress",
			loading: "Loading voices…",
			noVoices: "No voices available for this language",
			reading: "Reading…",
			paused: "Paused",
			stopped: "Stopped",
			completed: "Reading completed",
			error: "Speech synthesis error",
			unsupported: "Speech synthesis not supported in this browser",
		},
	},

	// Homepage
	home: {
		heroTitle: "AI Intelligence Blog",
		heroSubtitle:
			"Architectural reasoning for AI-intensive systems. Evidence-first. ADHD-friendly by structure.",
		aboutTitle: "About this publication",
		aboutText:
			"Written by a system architect for system architects. Every claim traces to a primary source or reproducible benchmark. Every pattern includes its failure mode and migration path. No vendor placements. No affiliate links. No hype.",
		techStack:
			"Bilingual NL/EN · WCAG 2.2 AA · Zero JS content · Static · Free hosting",
	},

	// About page
	about: {
		title: "About this publication",
		description:
			"AI Intelligence Blog — architectural reasoning for AI-intensive systems, written by a system architect for system architects.",
		mission: "Mission",
		missionText:
			"System architects and principal engineers operate at the boundary of software architecture, data engineering, and ML ops. They think in bounded contexts, traceability matrices, and decision records — not prompts. This publication exists to serve that practice.",
		successText:
			'Success means a reader forwards an article to their team with "this is why we\'re doing it this way" — not "this is cool." The publication becomes a cited reference in ADRs, RFCs, and architecture review decks.',
		editorialStandards: "Editorial standards",
		standards: [
			{
				title: "Evidence is structural",
				desc: "Citations, references, reproducibility artifacts, and failure modes are first-class content elements — not footnotes.",
			},
			{
				title: "Architecture over aesthetics",
				desc: "Visual design serves scannability and comprehension; it never leads.",
			},
			{
				title: "ADHD-friendly by default",
				desc: "Hierarchy, progressive disclosure, chunking, consistent signposting, and motion reduction are baked into the component system.",
			},
			{
				title: "Cost discipline as craft",
				desc: "Zero recurring cost is a design constraint that sharpens decisions: local fonts, static hosting, no third-party SaaS.",
			},
			{
				title: "Bilingual precision",
				desc: "Terminology is consistent across NL/EN. Translation is architectural — concepts map 1:1; idioms do not.",
			},
		],
		contentTypes: "Content types",
		contentTypesTable: [
			{
				type: "Architectural Essays",
				purpose: "Deep-dive analysis of AI system design decisions",
				structure:
					"Context → Criteria → Evaluation → Decision → Migration → Failure Modes → References",
			},
			{
				type: "Pattern Catalogs",
				purpose: "Reusable architectural patterns with code",
				structure:
					"Problem → Forces → Solution → Trade-offs → Implementation → Anti-patterns",
			},
			{
				type: "Decision Records (ADR)",
				purpose: "Documented architectural choices with rationale",
				structure:
					"Status → Context → Decision → Consequences → Alternatives Considered",
			},
			{
				type: "Model/Provider Evaluations",
				purpose:
					"Reproducible benchmarks against architectural criteria",
				structure:
					"Criteria → Methodology → Results → Sensitivity Analysis → Recommendation",
			},
			{
				type: "Tooling Deep-Dives",
				purpose:
					"Architectural analysis of frameworks and infrastructure",
				structure:
					"Architecture → Boundaries → Observability → Operations → Migration Path",
			},
		],
		accessibility: "Accessibility & Inclusion",
		accessibilityText:
			"This publication targets WCAG 2.2 AA as a minimum baseline, with additional ADHD-specific requirements:",
		accessibilityItems: [
			"Clear heading hierarchy (enforced by content schema)",
			"Predictable layout: same landmark structure on every article",
			"Progress indicators: reading time, TOC with scroll position (the crease graph)",
			"Reduced motion: @media (prefers-reduced-motion: reduce) disables all transitions",
			"High contrast mode compatible: CSS custom properties enable user overrides",
			"No auto-play, no carousels, no popups, no interstitials",
			"Keyboard navigation: every interactive element reachable and operable",
			"Focus visible: :focus-visible outlines on all links, buttons, code copy buttons",
		],
		technology: "Technology",
		techItems: [
			{
				label: "Framework",
				value: "Astro 7+ (static, zero-JS by default)",
			},
			{
				label: "Language",
				value: "TypeScript (strict), MDX for content",
			},
			{
				label: "Styling",
				value: "CSS custom properties, no framework — Miura-fold design system",
			},
			{
				label: "Fonts",
				value: "Atkinson (reading), JetBrains Mono (structural) — both local, self-hosted",
			},
			{ label: "Images", value: "Sharp optimization at build time" },
			{
				label: "Package Manager",
				value: "pnpm only (locked, reproducible)",
			},
			{ label: "CI/CD", value: "GitHub Actions (free tier)" },
			{
				label: "Hosting",
				value: "Netlify / Vercel / Cloudflare Pages (free tier)",
			},
		],
		contact: "Contact",
		contactText:
			"This publication has no comments, no newsletter, no tracking, and no social media integration by design. If you have a technical correction or a pattern to contribute, open an issue on the GitHub repository.",
		decision:
			"Decision: This publication will never introduce paid services, affiliate links, vendor-influenced framing, or third-party tracking. Cost discipline is a craft constraint, not a budget limit.",
	},

	// Footer
	footer: {
		rights: "All rights reserved.",
		noTracking: "No tracking · No cookies · No third-party scripts",
		rss: "RSS",
		sitemap: "Sitemap",
	},

	// Callout types
	callout: {
		evidence: "Evidence",
		failure: "Failure Mode",
		migration: "Migration Path",
		decision: "Decision",
	},

	// Search page
	search: {
		title: "Search",
		description: "Search all articles and patterns",
		placeholder: "Search articles, patterns, decisions…",
	},

	// Topics page
	topics: {
		title: "Topics",
		description: "Browse articles by topic",
		browse: "Browse {count} topics across {total} articles",
	},

	// Error states
	error: {
		notFound: "Page not found",
		notFoundDesc: "The requested page does not exist or has been moved.",
		backHome: "Back to home",
	},

	// Cookie Consent
	cookieConsent: {
		title: "Cookie Preferences",
		description:
			"We respect your privacy. This site uses only essential cookies by default. Optional categories help us improve your experience.",
		close: "Close",
		necessary: {
			label: "Necessary",
			alwaysOn: "Always active",
			description:
				"Required for the website to function properly. Cannot be disabled.",
		},
		preferences: {
			label: "Preferences",
			description:
				"Remember your display preferences (theme, reading mode, font size).",
		},
		analytics: {
			label: "Analytics",
			description:
				"Help us understand how visitors interact with the site (anonymous, privacy-friendly).",
		},
		rejectAll: "Reject All",
		acceptAll: "Accept All",
		savePreferences: "Save Preferences",
		managePreferences: "Manage cookie preferences",
		manageLabel: "Cookie Preferences",
		learnMore: "Learn more about our privacy practices",
		saved: "Preferences saved",
		rejected: "All optional cookies rejected",
		accepted: "All cookies accepted",
	},
};

// Type helper for translation keys
export type TranslationKeys = typeof en;
