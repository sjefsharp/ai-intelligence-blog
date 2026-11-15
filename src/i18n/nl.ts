/**
 * Dutch translations for AI Intelligence Blog
 */
export const nl = {
	// Site
	siteTitle: "AI Intelligence Blog",
	siteDescription:
		"Architecturale redenering voor AI-intensieve systemen. Evidence-first. ADHD-vriendelijk door structuur.",

	// Navigation
	nav: {
		home: "Home",
		essays: "Essays",
		topics: "Onderwerpen",
		search: "Zoeken",
		about: "Over",
	},

	// Language switcher
	lang: {
		label: "Taal",
		en: "Engels",
		nl: "Nederlands",
		switchTo: "Schakel naar {lang}",
		current: "Huidige taal: {lang}",
	},

	// Theme switcher
	theme: {
		label: "Thema",
		system: "Systeem",
		light: "Licht",
		dark: "Donker",
		switchTo: "Schakel naar {theme} thema",
		current: "Huidig thema: {theme}",
	},

	// Article meta
	meta: {
		readTime: "{time} min leestijd",
		updated: "Bijgewerkt op {date}",
		published: "Gepubliceerd op {date}",
		source: "Bron",
		tags: "Tags",
		by: "Door",
	},

	// UI elements
	ui: {
		searchPlaceholder: "Zoek artikelen, patronen, beslissingen…",
		searchResults: "Zoekresultaten",
		noResults: "Geen resultaten gevonden. Probeer andere zoektermen.",
		recentArticles: "Recente artikelen",
		viewAll: "Bekijk alle {count} →",
		viewAllEssays: "Alle essays bekijken →",
		viewAllTopics: "Alle onderwerpen bekijken →",
		onThisPage: "Op deze pagina",
		references: "Referenties",
		aboutThisPublication: "Over deze publicatie",
		patternCatalog: "Patronencatalogus",
		latestEssays: "Laatste essays",
		moreTopics: "Meer onderwerpen",
		articlesTagged: 'artikelen getagd met "{tag}"',
		articleTagged: 'artikel getagd met "{tag}"',
		noArticlesForTopic: "Geen artikelen gevonden voor dit onderwerp.",
		loading: "Laden…",
		keyFindings: "Belangrijkste bevindingen",
		clickToExpand: "Klik om uit te vouwen",
		fontSize: "Lettergrootte",
		lineHeight: "Regelafstand",
		columnWidth: "Kolombreedte",
		readingMode: "Leesmodus",
		readingModeSettings: "Leesinstellingen",
		focusMode: "Focusmodus",
		exitFocus: "Focus verlaten",
		increase: "Vergroten",
		decrease: "Verkleinen",
		resetToDefaults: "Standaardwaarden herstellen",
		close: "Sluiten",
		readAloud: {
			label: "Voorlezen",
			controls: "Afspeelbediening",
			play: "Afspelen",
			pause: "Pauzeren",
			resume: "Hervatten",
			stop: "Stoppen",
			progress: "Leesvoortgang",
			loading: "Stemmen laden…",
			noVoices: "Geen stemmen beschikbaar voor deze taal",
			reading: "Aan het lezen…",
			paused: "Gepauzeerd",
			stopped: "Gestopt",
			completed: "Lezen voltooid",
			error: "Spraaksynthese fout",
			unsupported: "Spraaksynthese niet ondersteund in deze browser",
		},
	},

	// Homepage
	home: {
		heroTitle: "AI Intelligence Blog",
		heroSubtitle:
			"Architecturale redenering voor AI-intensieve systemen. Evidence-first. ADHD-vriendelijk door structuur.",
		aboutTitle: "Over deze publicatie",
		aboutText:
			"Geschreven door een systeemarchitect voor systeemarchitecten. Elke claim traceert naar een primaire bron of reproduceerbare benchmark. Elk patroon bevat zijn falingsmodus en migratiepad. Geen vendor placements. Geen affiliate links. Geen hype.",
		techStack:
			"Bilinguaal NL/EN · WCAG 2.2 AA · Nul JS content · Statisch · Gratis hosting",
	},

	// About page
	about: {
		title: "Over deze publicatie",
		description:
			"AI Intelligence Blog — architecturale redenering voor AI-intensieve systemen, geschreven door een systeemarchitect voor systeemarchitecten.",
		mission: "Missie",
		missionText:
			"Systeemarchitecten en principal engineers opereren op de grens van software-architectuur, data-engineering en ML-ops. Ze denken in gebonden contexten, traceerbaarheidsmatrices en beslissingsrecords — niet in prompts. Deze publicatie dient die praktijk.",
		successText:
			'Succes betekent dat een lezer een artikel doorstuurt aan hun team met "dit is waarom we het zo doen" — niet "dit is cool." De publicatie wordt een geciteerde referentie in ADRs, RFCs en architectuurreviewdecks.',
		editorialStandards: "Editoriale standaarden",
		standards: [
			{
				title: "Evidence is structureel",
				desc: "Citaties, referenties, reproduceerbare artefacten en falingsmodi zijn eersteklas content-elementen — geen voetnoten.",
			},
			{
				title: "Architectuur boven esthetiek",
				desc: "Visueel design dient scannability en begrip; het leidt nooit.",
			},
			{
				title: "ADHD-vriendelijk by default",
				desc: "Hiërarchie, progressieve onthulling, chunking, consistente wegwijzers en bewegingsreductie zijn ingebouwd in het componentsysteem.",
			},
			{
				title: "Kostendiscipline als vakmanschap",
				desc: "Nul terugkerende kosten is een designbeperking die beslissingen scherpt: lokale fonts, statische hosting, geen third-party SaaS.",
			},
			{
				title: "Bilinguale precisie",
				desc: "Terminologie is consistent in NL/EN. Vertaling is architecturaal — concepten mappen 1:1; idiomen niet.",
			},
		],
		contentTypes: "Contenttypen",
		contentTypesTable: [
			{
				type: "Architecturale Essays",
				purpose:
					"Diepgravende analyse van AI-systeemontwerpbeslissingen",
				structure:
					"Context → Criteria → Evaluatie → Beslissing → Migratie → Falingsmodi → Referenties",
			},
			{
				type: "Patronencatalogi",
				purpose: "Herbruikbare architecturale patronen met code",
				structure:
					"Probleem → Krachten → Oplossing → Afwegingen → Implementatie → Anti-patronen",
			},
			{
				type: "Beslissingsrecords (ADR)",
				purpose:
					"Gedocumenteerde architecturale keuzes met rationaliteit",
				structure:
					"Status → Context → Beslissing → Gevolgen → Overwogen alternatieven",
			},
			{
				type: "Model/Provider Evaluaties",
				purpose:
					"Reproduceerbare benchmarks tegen architecturale criteria",
				structure:
					"Criteria → Methodologie → Resultaten → Gevoeligheidsanalyse → Aanbeveling",
			},
			{
				type: "Tooling Diepgraven",
				purpose:
					"Architecturale analyse van frameworks en infrastructuur",
				structure:
					"Architectuur → Grenzen → Observabiliteit → Operaties → Migratiepad",
			},
		],
		accessibility: "Toegankelijkheid & Inclusie",
		accessibilityText:
			"Deze publicatie nastreeft WCAG 2.2 AA als minimumbasis, met extra ADHD-specifieke eisen:",
		accessibilityItems: [
			"Duidelijke kopstructuur (afgedwongen door content schema)",
			"Voorspelbare layout: dezelfde landmarkstructuur op elk artikel",
			"Voortgangsindicatoren: leestijd, inhoudsopgave met scrollpositie (het crease graph)",
			"Verminderde beweging: @media (prefers-reduced-motion: reduce) schakelt alle overgangen uit",
			"Hoge contrastmodus compatibel: CSS custom properties staan gebruikersoverrides toe",
			"Geen auto-play, carousels, popups, interstitials",
			"Toetsenbordnavigatie: elk interactief element bereikbaar en bedienbaar",
			"Focus zichtbaar: :focus-visible outlines op alle links, knoppen, code-copy knoppen",
		],
		technology: "Technologie",
		techItems: [
			{
				label: "Framework",
				value: "Astro 7+ (statisch, nul-JS by default)",
			},
			{ label: "Taal", value: "TypeScript (strict), MDX voor content" },
			{
				label: "Styling",
				value: "CSS custom properties, geen framework — Miura-fold designsysteem",
			},
			{
				label: "Fonts",
				value: "Atkinson (lezen), JetBrains Mono (structureel) — beide lokaal, self-hosted",
			},
			{ label: "Afbeeldingen", value: "Sharp optimalisatie bij build" },
			{
				label: "Package Manager",
				value: "pnpm only (gelockt, reproduceerbaar)",
			},
			{ label: "CI/CD", value: "GitHub Actions (gratis tier)" },
			{
				label: "Hosting",
				value: "Netlify / Vercel / Cloudflare Pages (gratis tier)",
			},
		],
		contact: "Contact",
		contactText:
			"Deze publicatie heeft geen comments, geen nieuwsbrief, geen tracking en geen social media integratie by design. Als je een technische correctie hebt of een patroon wilt bijdragen, open een issue op de GitHub repository.",
		decision:
			"Beslissing: Deze publicatie zal nooit betaalde diensten, affiliate links, vendor-beïnvloede framing of third-party tracking introduceren. Kostendiscipline is een vakmanschapsbeperking, geen budgetlimiet.",
	},

	// Footer
	footer: {
		rights: "Alle rechten voorbehouden.",
		noTracking: "Geen tracking · Geen cookies · Geen third-party scripts",
		rss: "RSS",
		sitemap: "Sitemap",
	},

	// Callout types
	callout: {
		evidence: "Bewijs",
		failure: "Falingsmodus",
		migration: "Migratiepad",
		decision: "Beslissing",
	},

	// Search page
	search: {
		title: "Zoeken",
		description: "Zoek over alle artikelen en patronen",
		placeholder: "Zoek artikelen, patronen, beslissingen…",
	},

	// Topics page
	topics: {
		title: "Onderwerpen",
		description: "Blader artikelen per onderwerp",
		browse: "Blader {count} onderwerpen over {total} artikelen",
	},

	// Error states
	error: {
		notFound: "Pagina niet gevonden",
		notFoundDesc: "De opgevraagde pagina bestaat niet of is verplaatst.",
		backHome: "Terug naar home",
	},

	// Cookie Consent
	cookieConsent: {
		title: "Cookievoorkeuren",
		description:
			"We respecteren uw privacy. Deze site gebruikt standaard alleen essentiële cookies. Optionele categorieën helpen ons uw ervaring te verbeteren.",
		close: "Sluiten",
		necessary: {
			label: "Nodzakelijk",
			alwaysOn: "Altijd actief",
			description:
				"Vereist voor het functioneren van de website. Kan niet worden uitgeschakeld.",
		},
		preferences: {
			label: "Voorkeuren",
			description:
				"Onthoud uw weergavevoorkeuren (thema, leesmodus, lettergrootte).",
		},
		analytics: {
			label: "Analytics",
			description:
				"Helpen ons begrijpen hoe bezoekers de site gebruiken (anoniem, privacy-vriendelijk).",
		},
		rejectAll: "Alles weigeren",
		acceptAll: "Alles accepteren",
		savePreferences: "Voorkeuren opslaan",
		managePreferences: "Cookievoorkeuren beheren",
		manageLabel: "Cookievoorkeuren",
		learnMore: "Meer informatie over ons privacybeleid",
		saved: "Voorkeuren opgeslagen",
		rejected: "Alle optionele cookies geweigerd",
		accepted: "Alle cookies geaccepteerd",
	},
};

// Type helper for translation keys
export type TranslationKeys = typeof nl;
