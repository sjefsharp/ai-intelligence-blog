# Support

## Getting Help

### Documentation
- **README.md**: Project overview, installation, development, deployment
- **CONTRIBUTING.md**: Development workflow, conventions, testing
- **AGENTS.md**: Repository-wide agent engineering rules
- **Nested AGENTS.md**: Directory-specific implementation guidance
- **docs/**: Architectural documentation, ADRs, domain specifications

### Common Issues

#### Build Failures
```bash
# Clean install
rm -rf node_modules pnpm-lock.yaml
pnpm install --frozen-lockfile
pnpm run build
```

#### Type Errors
```bash
pnpm astro check
# Fix reported errors, then rebuild
```

#### Test Failures
```bash
# Unit tests
pnpm test

# Accessibility tests (requires dev server)
astro dev --background &
pnpm exec playwright test
kill %1
```

#### Dependency Issues
```bash
pnpm audit --prod
pnpm audit --dev
# Update vulnerable packages
pnpm update <package>@latest
```

### Environment Problems
- Ensure Node.js ≥ 22.23.4: `node --version`
- Ensure pnpm ≥ 9.0.0: `pnpm --version`
- Check `.env.local` exists with valid keys (for AI features)

## Reporting Bugs

Before reporting:
1. Search existing GitHub Issues
2. Reproduce with minimal steps
3. Include: OS, Node version, pnpm version, error output

File at: https://github.com/<owner>/ai-intelligence-blog/issues

Template:
- **Description**: Clear, concise description
- **Steps to Reproduce**: Numbered list
- **Expected Behavior**: What should happen
- **Actual Behavior**: What happens
- **Environment**: `node -v`, `pnpm -v`, OS
- **Logs/Output**: Relevant error messages

## Feature Requests

File at: https://github.com/<owner>/ai-intelligence-blog/discussions

Include:
- Problem statement
- Proposed solution
- Alternatives considered
- Implementation complexity estimate

## Security Vulnerabilities

**Do not create public issues.** See [SECURITY.md](SECURITY.md).

Email: security@<domain>

## Community

- GitHub Discussions: General questions, ideas, announcements
- Pull Requests: Code contributions, documentation improvements
- Issues: Bug reports (non-security), task tracking

## Maintainer Response Times

- Security reports: 48 hours
- Bug reports: 5 business days
- Feature requests: 10 business days
- PR reviews: 3 business days

## Professional Support

For commercial support, customization, or enterprise deployment, contact: **support@<domain>**