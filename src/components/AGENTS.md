# AGENTS.md — Frontend Component Guidelines

This file contains scoped engineering rules for `src/components/`. Load only when working in this directory.

## Component Conventions

### File Structure
- One component per `.astro` file
- PascalCase filenames: `Header.astro`, `ThemeToggle.astro`
- Co-locate component-specific styles in `<style>` block or use global CSS custom properties

### Semantic HTML Requirements
- Use proper landmarks: `<header>`, `<nav>`, `<main>`, `<article>`, `<aside>`, `<footer>`
- Single `<h1>` per page; no skipped heading levels
- Interactive elements: `<button>`, `<a>`, `<input>`, `<select>` — never `<div>`/`<span>` with `onclick`

### Accessibility (WCAG 2.2 AA)
- Focus visible: `:focus-visible` outlines on all interactive elements
- Keyboard navigation: Tab/Enter/Space operable
- ARIA only when native HTML insufficient
- Images: meaningful `alt` (empty `alt=""` for decorative)
- Color contrast: ≥ 4.5:1 text, ≥ 3:1 large text/UI against `--sheet`/`--sheet-dark`

### Styling
- Use CSS custom properties from `global.css`: `--ink`, `--gold`, `--sheet`, `--valley`, `--mountain`, `--focus`
- No hardcoded colors, spacing, or font sizes
- Respect `prefers-reduced-motion: reduce` and `prefers-contrast: high`
- Fluid typography: `clamp()` for responsive sizes
- Dark theme via `[data-theme="dark"]` selector

### Internationalization
- All user-facing strings via `getTranslation(locale)` from `src/i18n`
- HTML `lang` attribute set on root element
- Language toggle component in masthead

### Props Interface
```ts
interface Props {
  // Required props first
  requiredProp: string;
  // Optional props with defaults
  optionalProp?: number;
  // Slots for composition
  children?: never; // Use <slot /> in template
}
```

### Testing
- Component visual regression via Playwright screenshots
- Accessibility tested in `tests/accessibility.spec.ts`
- Unit tests for pure logic in `src/lib/` (not in components)

## Component Checklist (apply to every new/modified component)
- [ ] Semantic landmark structure
- [ ] Heading order validated
- [ ] Interactive elements have focus styles
- [ ] Images have `alt` (or `alt=""` + `role="presentation"`)
- [ ] Color contrast verified against CSS custom properties
- [ ] No `onclick` on non-interactive elements
- [ ] Forms: `<label>` associated, error messages via `aria-describedby`
- [ ] Reduced motion supported
- [ ] Dark theme works
- [ ] Dutch translations added to `src/i18n/nl.ts`

## Common Patterns

### Button/Link
```astro
<a href="/path" class="button">Label</a>
<button class="button" aria-pressed="false">Toggle</button>
```

### Skip Link (required on all pages)
```astro
<a href="#main-content" class="skip-link">Skip to main content</a>
```

### Theme-Aware Colors
```css
color: var(--ink);
background: var(--sheet);
border-color: var(--mountain-light);
```

### Focus Styles
```css
:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}
```