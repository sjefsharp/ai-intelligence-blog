# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Repository governance foundation (Git hooks, CI/CD, security policies)
- Professional repository documentation (README, CONTRIBUTING, LICENSE, SECURITY, CODE_OF_CONDUCT, SUPPORT)
- GitHub Actions workflows for CI, CodeQL, Super-Linter, SonarCloud
- Lefthook Git hooks (pre-commit, commit-msg, pre-push)
- Commitlint configuration for Conventional Commits
- Playwright configuration for accessibility testing
- Vitest configuration for unit testing
- dependabot configuration for automated dependency updates
- PR template and CODEOWNERS
- .editorconfig and .gitattributes

### Changed

- Updated README.md from Astro starter template to project-specific documentation
- Enhanced AGENTS.md with complete governance rules

### Fixed

- TypeScript errors in test files (astro check now passes)
- Playwright test configuration for accessibility tests

## [0.0.1] - 2024-11-08

### Added

- Initial Astro blog setup with TypeScript, MDX, RSS, Sitemap
- Multilingual support (English/Dutch) with i18n routing
- Content collections with Zod schema validation
- Local font integration (Atkinson, JetBrains Mono)
- Editorial pipeline foundation (src/lib/)
  - Source collection adapters (RSS, ArXiv, GitHub)
  - Editorial window (Amsterdam timezone)
  - Historical regression analysis
  - Omission review
  - Evidence verification
  - Editorial selection
  - Fact dossier compilation
  - Publication assembly and validation
  - Publication acceptance gates
  - Signal desk processing
  - Novelty classification
  - Book delta (knowledge continuity)
  - Workflow orchestration
- Accessibility components (ThemeToggle, CookieConsent, ReadingMode, etc.)
- Visualization components (CreaseGraph, ArticleVisualizations, etc.)
- Global CSS design system (Miura-fold, CSS custom properties)
- Test infrastructure (Vitest, Playwright, axe-core)

---

## Release Template

### Added

- New features

### Changed

- Changes in existing functionality

### Deprecated

- Soon-to-be removed features

### Removed

- Removed features

### Fixed

- Bug fixes

### Security

- Vulnerability fixes
