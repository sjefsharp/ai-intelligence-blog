## Description

<!-- Briefly describe the purpose and scope of this PR -->

## Related Area

<!-- Check all that apply -->

- [ ] Frontend / Astro components
- [ ] Content / Blog posts
- [ ] Editorial pipeline (src/lib/)
- [ ] CI/CD / GitHub Actions
- [ ] Security / Dependencies
- [ ] Documentation
- [ ] Accessibility
- [ ] Localization (i18n)
- [ ] Tests
- [ ] Other: ___________

## Changes Made

<!-- List the specific changes in this PR -->

## Architecture Impact

<!-- Does this change affect architecture boundaries, data flow, or integration contracts? -->

- [ ] No architecture impact
- [ ] Minor: Internal implementation detail
- [ ] Moderate: Changes component API or data shape
- [ ] Major: New bounded context or integration contract

If moderate/major, reference ADR or design doc: ___________

## Security Impact

<!-- Does this change affect security posture? -->

- [ ] No security impact
- [ ] Adds/updates dependencies (audit required)
- [ ] Changes authentication/authorization
- [ ] Modifies content security policy
- [ ] Handles secrets or sensitive data
- [ ] Other: ___________

## Validation Evidence

<!-- Required: Evidence that validation gates pass -->

- [ ] `pnpm install --frozen-lockfile` ✅
- [ ] `pnpm astro check` ✅
- [ ] `pnpm run build` ✅
- [ ] `pnpm test` ✅
- [ ] `pnpm exec playwright test` ✅ (accessibility)
- [ ] `pnpm audit --prod` ✅ (no high/critical)
- [ ] Manual testing: ___________

## Accessibility Impact

<!-- Does this change affect WCAG 2.2 AA compliance? -->

- [ ] No accessibility impact
- [ ] Improves accessibility
- [ ] Requires accessibility review (new interactive elements, color changes, ARIA)
- [ ] Tested with keyboard navigation
- [ ] Tested with screen reader
- [ ] Tested at 200% zoom
- [ ] Tested with reduced motion

## Breaking Changes

<!-- List any breaking changes and migration path -->

- [ ] No breaking changes
- [ ] Breaking changes (describe): ___________

## Stack Dependencies

<!-- If this PR is part of a stack, list dependent PRs -->

- [ ] Independent PR (no stack dependencies)
- [ ] Stacked on: #PR_NUMBER
- [ ] Blocks: #PR_NUMBER

## Changelog Impact

<!-- Should this appear in CHANGELOG.md under Unreleased? -->

- [ ] Yes (notable user-facing or developer-facing change)
- [ ] No (internal/refactor only)

If yes, draft entry:

```
### Added/Changed/Fixed
- Brief description
```

## Reviewer Checklist

<!-- Reviewers: verify each item -->

- [ ] Code follows project conventions (AGENTS.md, nested AGENTS.md)
- [ ] TypeScript strict mode passes
- [ ] No unused variables/imports (warnings acceptable)
- [ ] Tests added/updated for new behavior
- [ ] Accessibility validated (if applicable)
- [ ] Security reviewed (if applicable)
- [ ] Documentation updated (if applicable)
- [ ] CHANGELOG.md updated (if applicable)
- [ ] No secrets committed
- [ ] No paid services introduced
