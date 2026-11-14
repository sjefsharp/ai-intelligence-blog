# AGENTS.md — Content Collection Guidelines

This file contains scoped engineering rules for `src/content/`. Load only when working in this directory.

## Content Collections

### Blog Collection (`src/content/blog/`)
- **Format**: Markdown (`.md`) or MDX (`.mdx`)
- **Schema**: Defined in `src/content.config.ts` (Zod)
- **Frontmatter**: Type-safe via Content Collections

### Frontmatter Schema
```ts
{
  title: string;                    // Required
  description: string;              // Required
  pubDate: Date;                    // Required (coerced from string)
  updatedDate?: Date;               // Optional
  heroImage?: ImageMetadata;        // Optional (Astro Image)
  tags: string[];                   // Default: []
  sourceUrl?: string;               // Optional (validated URL)
  readingTime?: number;             // Optional (positive integer, minutes)
}
```

### Validation Rules
- `title`: Non-empty, descriptive
- `description`: Non-empty, ≤ 300 chars (for SEO/meta)
- `pubDate`: Valid date, not in future (enforced at build)
- `updatedDate`: If present, ≥ `pubDate`
- `sourceUrl`: Valid HTTPS URL if present
- `tags`: Lowercase, kebab-case, no duplicates
- `readingTime`: Calculated at build if omitted

### File Organization
```
src/content/blog/
├── first-post.md
├── second-post.md
├── third-post.md
├── using-mdx.mdx
└── markdown-style-guide.md
```

### Naming Convention
- Kebab-case filenames: `my-blog-post.md`
- Matches URL slug: `/blog/my-blog-post/`
- No date prefix in filename (date in frontmatter)

### Content Guidelines
- Write in English by default
- Dutch translations: separate file with `-nl.md` suffix (future)
- Use semantic Markdown: headings, lists, code blocks, blockquotes
- Embed components via MDX when needed: `<Callout type="evidence" />`
- Images in `src/assets/` or `public/`, referenced via Astro `Image` component

### Publication Lifecycle
1. **Draft**: Local only, not committed
2. **Ready**: PR opened, CI passes
3. **Published**: Merged to `main`, deployed
4. **Updated**: `updatedDate` added, PR for changes

### SEO & Metadata
- `title` → `<title>`, Open Graph `og:title`, Twitter `twitter:title`
- `description` → `<meta name="description">`, `og:description`, `twitter:description`
- `pubDate` → `<time datetime>`, `article:published_time`
- `updatedDate` → `article:modified_time`
- `tags` → `article:tag`, topic pages
- `heroImage` → `og:image`, `twitter:image`

### RSS & Sitemap
- Auto-generated via `@astrojs/rss` and `@astrojs/sitemap`
- All blog entries included
- `<lastmod>` from `updatedDate` or `pubDate`
- `<changefreq>` weekly for blog index

### Accessibility
- Heading hierarchy: Single `<h1>` (title), then `<h2>`+
- Code blocks: language specified for syntax highlighting
- Images: descriptive `alt` text
- Links: descriptive text, `rel="noopener noreferrer"` for external

### Internationalization
- Blog posts currently English only
- Future: Dutch translations in `src/content/blog/nl/`
- Language routing: `/en/blog/...`, `/nl/blog/...`

## Editing Workflow
1. Create/edit `.md` file in `src/content/blog/`
2. Validate frontmatter: `pnpm astro check`
3. Preview: `astro dev`
4. Commit with conventional commit: `feat(content): add blog post "..."`
5. PR review and merge