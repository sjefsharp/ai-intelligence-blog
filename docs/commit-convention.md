# Commit Message Convention

This project uses **Gitmoji + Conventional Commits** for commit messages.

## Format

```text
<gitmoji> <type>(<scope>): <subject>

<body>

<footer>
```

### Gitmoji Prefix (Required)

Every commit MUST start with a Gitmoji emoji (unicode) or code:

| Format              | Example                                |
| ------------------- | -------------------------------------- |
| Unicode (preferred) | `✨ feat(ci): Add new feature`         |
| Code                | `:sparkles: feat(ci): Add new feature` |

**Use the unicode emoji** for better readability. See [gitmoji.dev](https://gitmoji.dev/) for the complete list.

### Type (Required)

Must be one of:

- `feat` — New feature
- `fix` — Bug fix
- `docs` — Documentation changes
- `style` — Code style/formatting (no logic change)
- `refactor` — Code refactoring
- `perf` — Performance improvement
- `test` — Adding/updating tests
- `chore` — Maintenance, config, dependencies
- `build` — Build system changes
- `ci` — CI/CD changes
- `a11y` — Accessibility improvements
- `security` — Security fixes
- `revert` — Reverting a previous commit

### Scope (Optional)

Lowercase, hyphen-separated: `(ci)`, `(auth)`, `(blog-post)`

### Subject (Required)

- **Sentence-case**: First letter capitalized, rest lowercase
- No trailing period
- Max 100 characters (including gitmoji and type)

### Body (Optional)

- Separated from header by blank line
- Wrap at 72 characters
- Explain _what_ and _why_, not _how_

### Footer (Optional)

- Separated from body by blank line
- Breaking changes: `BREAKING CHANGE: <description>`
- Issue references: `Closes #123`, `Refs #456`

## Examples

### Feature

```text
✨ feat(blog): Add support for MDX components

Allows embedding React components in blog posts using MDX syntax.
```

### Bug Fix

```text
🐛 fix(header): Resolve navigation overlap on mobile

The header z-index was too low causing overlap with content.
Closes #42
```

### Documentation

```text
📝 docs: Update CONTRIBUTING with commit guidelines

Adds examples for gitmoji + conventional commit format.
```

### Breaking Change

```text
💥 feat(api)!: Remove deprecated v1 endpoints

BREAKING CHANGE: v1 API endpoints removed. Migrate to v2.
Refs #100
```

### Chore

```text
🔧 chore(deps): Upgrade Astro to v7.5

Updates dependencies and fixes peer dependency warnings.
```

## Common Gitmojis

| Emoji | Code                      | Use Case          |
| ----- | ------------------------- | ----------------- |
| ✨    | `:sparkles:`              | New feature       |
| 🐛    | `:bug:`                   | Bug fix           |
| 📝    | `:memo:`                  | Documentation     |
| 🎨    | `:art:`                   | Code style/format |
| ♻️    | `:recycle:`               | Refactor          |
| ⚡    | `:zap:`                   | Performance       |
| ✅    | `:white_check_mark:`      | Tests             |
| 🔧    | `:wrench:`                | Config/chore      |
| 🏗️    | `:building_construction:` | Build             |
| 👷    | `:construction_worker:`   | CI                |
| ♿    | `:wheelchair:`            | Accessibility     |
| 🔒    | `:lock:`                  | Security          |
| ⏪    | `:rewind:`                | Revert            |
| 💥    | `:boom:`                  | Breaking change   |
| 🚚    | `:truck:`                 | Move/rename       |
| 🔖    | `:bookmark:`              | Release/version   |

## Validation

### Local (pre-commit)

```bash
# Install hooks
pnpm exec lefthook install

# Manual test
echo "✨ feat(ci): Test" | pnpm exec commitlint
```

### CI (Pull Requests)

All commits in a PR are validated by the `commitlint` job.

## References

- [Conventional Commits](https://www.conventionalcommits.org/)
- [Gitmoji](https://gitmoji.dev/)
- [commitlint](https://commitlint.js.org/)
- [commitlint llms-full.txt](https://commitlint.js.org/llms-full.txt)
