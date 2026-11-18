# Astro components — scoped instructions

Scope: `src/components/**`; inherit root `AGENTS.md`. Applicable to component markup, styles, client behavior, accessibility and localized interface text.

## Read when relevant

- `DESIGN.md`, `src/styles/global.css` for design tokens and layouts.
- `src/i18n/{nl,en}.ts` and `src/i18n/index.ts` for localization.
- `src/layouts/BlogPost.astro` and actual page for landmark and heading hierarchy.
- `tests/accessibility*.spec.ts` and `playwright.config.ts` for current browser/axe coverage.

## Operational rules

- When adding an interaction, use native semantics (`button` for actions, `a` for navigation), visible focus, keyboard access, correct state and appropriate accessible labels. Check manually; axe alone is not proof of WCAG compliance.
- When changing layout/headings, inspect the containing page to avoid duplicate `<main>`/`h1`, broken heading hierarchy or hidden critical caveats.
- When changing a graphic, include correct labels, units, provenance and an accessible text equivalent. Never use fabricated data or unlabelled placeholders as published evidence.
- When changing displayed strings, update both supported locales where applicable; verify correct `lang`, URLs, date formatting and evidence links.
- When handling untrusted metadata, use safe Astro rendering and sanitize URL values. Escape untrusted content in HTML/Markdown contexts.
- Reuse existing CSS custom properties and components. Keep static HTML by default; add client JS only for necessary interaction and preserve reduced-motion behavior.
- For reading/listening changes, test small screens, zoom/reflow, reduced motion, keyboard navigation and state across route transitions.

## Trigger → action → verification

| Trigger                    | Action                                                                             | Verification                                                |
| -------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `.astro` / props edited    | Inspect callers, run relevant Prettier/ESLint and `pnpm exec astro check`          | Correct types and no new errors                             |
| Visible interaction edited | Run relevant `pnpm exec playwright test` suite and manually inspect keyboard/focus | Expected state/interaction and accessible behavior          |
| Translation or link edited | Compare `src/i18n/` and rendered route metadata                                    | Both locales coherent, links and lang attributes valid      |
| UI change is ready         | Run `pnpm run build`; keep hooks and CI enabled                                    | Real exit status and applicable screenshots/traces supplied |

## Refactoring caution

`ReadingMode.astro`, `ReadAloud.astro` and `CookieConsent.astro` are relatively large. Inspect shared state and listener cleanup **before** proposing splitting; do not change the framework or add dependencies merely to lower file length.

```

```
