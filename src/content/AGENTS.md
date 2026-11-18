# Astro content collection — scoped instructions

Scope: `src/content/**`; inherit root `AGENTS.md`. Applies to blog Markdown/MDX, frontmatter and content metadata, **not** directly to canonical daily `editions/**` output.

## Repository facts

- `src/content.config.ts` defines the Astro `blog` collection with Zod. Existing required fields: `title`, `description`, `pubDate`; existing optional/default fields: `updatedDate`, `heroImage`, `sourceUrl`, `readingTime`, `tags`.
- Do not claim the current schema enforces HTTPS-only URLs, a description length cap, tag normalization, future-date exclusion or `updatedDate >= pubDate`; those would need explicit schema rules and tests.
- Canonical daily artifacts are generated under `editions/edition_YYYY-MM-DD/` by the pipeline. Example blog posts and demos are **not** validated daily publications.

## Trigger → action → verification

| Trigger                      | Action                                                                                             | Verification                                                               |
| ---------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Frontmatter edited           | Compare `src/content.config.ts`, existing post formats and route consumers                         | Schema parses; RSS/routes/build remain valid                               |
| Source claim added           | Verify linked source, date, citation and any provenance metadata                                   | No unsupported or falsely verified statement                               |
| Language content changed     | Follow the artifact's locale and source contract, check Dutch/English derivatives where applicable | Facts, uncertainty and dates agree across locales                          |
| Canonical artifact requested | Use domain generator/acceptance workflow, not manual modification in `src/content/`                | Complete provenance-bearing `editions/**` output or explicit blocked state |
| Page/content ready           | Run targeted content check and `pnpm run build`; use existing hooks/CI                             | Exit statuses recorded; no broken route or link                            |

## Specific safeguards

- Use stable slugs and canonical URLs; avoid silently renaming published identity.
- Escape/validate untrusted Markdown/MDX, hyperlinks, interpolated tables and metadata. A link to a claim is not proof it was verified.
- Preserve Dutch canonical readable/listening output semantics when producing English derivatives; do not silently reclassify facts during translation.
- When changing content schemas, add tests for malformed dates, invalid URLs, missing required fields and compatibility with existing content.
- Daily publication date window and schedule belong to `src/lib/editorial-window.ts` and the publication contract. The **intended** 05:00 Amsterdam schedule is not proof of a running scheduler.
