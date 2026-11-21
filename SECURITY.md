# Security Policy

## Supported Versions

Only the latest release on the `main` branch receives security updates. This is a static site with no server runtime; vulnerabilities in dependencies are the primary concern.

| Version | Supported |
| ------- | --------- |
| Latest  | ✅        |
| Older   | ❌        |

## Reporting a Vulnerability

**Do not create public issues for security vulnerabilities.**

Email security concerns to: **security@<domain>** (replace with actual contact)

Include:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We will acknowledge receipt within 48 hours and provide a remediation timeline.

## Security Measures

### Dependency Management

- `pnpm audit --prod` run before every release
- Build fails on `high` or `critical` production vulnerabilities
- `devDependencies` audited separately (warn only)
- Dependabot configured for automated updates

### Secrets

- **No secrets in repository** — ever (not in history, not in `.env`, not in code)
- Local development: `.env.local` (gitignored)
- CI/CD: GitHub Actions secrets only
- OpenRouter API key rotated quarterly

### Content Security

- No user-generated content (author-only blog)
- No inline scripts (Astro strips them; CSP `script-src 'self'` compatible)
- External links: `rel="noopener noreferrer"` on all `target="_blank"`
- Images: Local assets or trusted CDN only (Astro `Image` component)

### AI Model Access

- Free-tier only: OpenRouter (`nvidia/nemotron-3-ultra-550b-a55b:free`)
- No paid models, no non-configured endpoints, no key sharing
- Rate limits respected with exponential backoff
- Automatic fallback through configured free providers

## Disclosure Timeline

1. **Day 0**: Vulnerability reported
2. **Day 1-2**: Acknowledgment and initial assessment
3. **Day 3-7**: Fix developed and tested
4. **Day 7-14**: Fix deployed to production
5. **Day 14+**: Public disclosure (if applicable)

We credit reporters who follow responsible disclosure.
