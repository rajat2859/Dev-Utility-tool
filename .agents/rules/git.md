---
trigger: always_on
description: Git workflow and Conventional Commit standards
---

# Git & Conventional Commits Rules

Maintain a clean, professional Git history throughout the project.

## Commit Message Format

```
<type>(<scope>): <description>
```

### Commit Types

- **`feat`**: A new feature for the user or application.
- **`fix`**: A bug fix.
- **`refactor`**: Code change that neither fixes a bug nor adds a feature (e.g. restructuring, cleaning).
- **`style`**: Formatting, whitespace, semicolon changes, or visual adjustments with no logic changes.
- **`docs`**: Documentation-only changes (README, comments, docs).
- **`chore`**: Maintenance tasks, dependency updates, tooling/config changes not affecting runtime code.
- **`perf`**: Code changes that improve performance.
- **`test`**: Adding missing tests or correcting existing tests.
- **`build`**: Changes that affect the build system or external dependencies/deployment.

---

## When to Commit

- Commit only when a meaningful section, feature, fix, or logical unit of work is complete.
- Do not make intermediate "WIP" commits unless explicitly required.

---

## Pre-Commit Checklist

Before committing, follow these steps strictly:

1. **Check git status**: Run `git status` to see what has changed, untracked files, and staged status.
2. **Review the diff**: Review `git diff` and `git diff --staged` to ensure only intended changes are included.
3. **Stage selectively**: Stage only files related to the current logical change.
4. **Do not combine unrelated work**: Keep commits focused and atomic.
5. **Use clear, specific commit messages**: Clearly state what was changed and why.
6. **No vague messages**: Never use messages like `"update"`, `"changes"`, `"fix stuff"`, or `"work done"`.
7. **Protect secrets**: Never commit secrets, API keys, `.env` files, or credentials.
8. **Avoid blind staging**: Do not blindly use `git add .` if unrelated files or untracked scratch artifacts exist.

---

## Examples

- `feat(hero): add homepage hero section`
- `feat(contact): add appointment request form`
- `style(header): refine mobile navigation`
- `fix(contact): validate phone number input`
- `refactor(services): simplify services data structure`
- `perf(images): optimize gallery image loading`
- `chore(deps): add gsap and motion`
- `build(netlify): configure Netlify deployment`
