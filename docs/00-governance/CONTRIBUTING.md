# Contributing to SQL Studio Pro

Thank you for your interest in contributing! This document outlines how to participate effectively.

---

## Code of Conduct

All contributors must follow our [Code of Conduct](./CODE_OF_CONDUCT.md). Be respectful, inclusive, and constructive.

---

## How to Contribute

### 1. Report Bugs
- Use GitHub Issues with the `bug` label
- Include: device model, OS version, app version, reproduction steps, screenshots
- Check for duplicates before filing

### 2. Request Features
- Use GitHub Issues with the `enhancement` label
- Describe the use case, not just the feature
- Include mockups or examples if possible

### 3. Submit Code

```bash
# 1. Fork the repository
# 2. Create a feature branch
git checkout -b feature/your-feature-name

# 3. Make changes with tests
# 4. Run linting
pnpm run typecheck

# 5. Commit with conventional commits
git commit -m "feat: add CSV export with custom delimiter"

# 6. Open a Pull Request
```

---

## Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

Types: feat, fix, docs, style, refactor, test, chore
Scopes: editor, database, history, settings, export, ui, security

Examples:
feat(editor): add SQL auto-complete for table names
fix(history): prevent duplicate entries on rapid execution
docs(readme): update setup instructions
```

---

## Pull Request Guidelines

- PR title must follow conventional commit format
- Include description of changes and why
- Link to related issue(s)
- All TypeScript checks must pass
- No console.log in production code
- Follow existing code style
- One feature or fix per PR

---

## Development Setup

```bash
# Prerequisites: Node.js 20+, pnpm, Expo CLI

# Install dependencies
pnpm install

# Start development server
pnpm --filter @workspace/mobile run dev

# Type check
pnpm --filter @workspace/mobile run typecheck
```

---

## Branch Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready code |
| `develop` | Integration branch |
| `feature/*` | New features |
| `fix/*` | Bug fixes |
| `docs/*` | Documentation only |

---

## Review Process

1. Automated checks run on every PR
2. One maintainer review required
3. All comments must be resolved
4. Squash merge to main

---

*Questions? Open a GitHub Discussion or email contribute@sqlstudiopro.app*
