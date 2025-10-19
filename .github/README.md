# GitHub Actions & CI/CD

## 📊 Workflow Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    GitHub Push/PR Event                     │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
         ┌────────────────────────┐
         │   Setup Environment    │
         │  • Checkout code       │
         │  • Setup Node.js 20    │
         │  • Install pnpm        │
         │  • Cache dependencies  │
         │  • Install packages    │
         └────────┬───────────────┘
                  │
                  ▼
         ┌────────────────────────┐
         │    Type Check          │
         │  pnpm typecheck        │
         └────────┬───────────────┘
                  │
                  ▼
         ┌────────────────────────┐
         │  Run Tests + Coverage  │
         │  • Execute vitest      │
         │  • Generate coverage   │
         │  • Parse percentage    │
         └────────┬───────────────┘
                  │
                  ▼
         ┌────────────────────────┐
         │    Build Project       │
         │  pnpm build            │
         └────────┬───────────────┘
                  │
                  ▼
         ┌────────────────────────┐
         │   Upload Artifacts     │
         │  • Coverage reports    │
         │  • Retain 30 days      │
         └────────┬───────────────┘
                  │
                  ▼
         ┌────────────────────────┐
         │  Update README Badges  │
         │  (main branch only)    │
         │  • Test status         │
         │  • Coverage %          │
         │  • Auto commit         │
         └────────────────────────┘
```

## 🎯 Badge System

### Test Status Badge
```
┌─────────────────────────────────────────┐
│  Tests: PASSING ✅  │  Tests: FAILING ❌  │
│  (brightgreen)      │  (red)              │
└─────────────────────────────────────────┘
```

### Coverage Badge (Color Scale)
```
Coverage %:  0────60────70────80────90────100
Color:       🔴    🟠    🟡    🟢    🟢
             red  orange yellow green bright
```

## 🚀 Quick Start Commands

```bash
# Test locally before pushing
pnpm test:ci

# Individual checks
pnpm typecheck      # TypeScript validation
pnpm coverage       # Tests with coverage
pnpm build          # Build verification

# Format & lint
pnpm format         # Format code
pnpm lint           # Check for issues
pnpm lint:fix       # Auto-fix issues
```

## 📁 Project Structure

```
redisX/
├── .github/
│   ├── workflows/
│   │   └── main.yaml           ⭐ CI Workflow
│   ├── README.md               📖 This file
│   └── WORKFLOW_SETUP.md       📋 Setup guide
├── docs/
│   └── CI.md                   📚 Detailed CI docs
├── scripts/
│   └── test-ci-locally.sh      🧪 Local CI test
├── coverage/                   📊 Generated reports
│   ├── coverage-summary.json   🎯 Used by CI
│   └── html/                   🌐 Interactive report
└── README.md                   🏠 Main docs + badges
```

## 🔄 Workflow Triggers

| Event | Branches | Actions |
|-------|----------|---------|
| Push | `main` | Full CI + Badge update |
| Pull Request | → `main` | Full CI (no badge update) |
| Manual | Any | Via Actions tab |

## 📈 Coverage Requirements

```yaml
Thresholds:
  statements: 95%  ████████████████████
  branches:   90%  ██████████████████
  functions:  95%  ████████████████████
  lines:      95%  ████████████████████
```

## 🎨 Badge Preview

Current badges in README.md:

![Tests](https://img.shields.io/badge/tests-unknown-lightgrey)
![Coverage](https://img.shields.io/badge/coverage-0%25-red)

After first successful run:

![Tests](https://img.shields.io/badge/tests-passing-brightgreen)
![Coverage](https://img.shields.io/badge/coverage-95%25-brightgreen)

## 🔗 Useful Links

- **Workflow File:** `.github/workflows/main.yaml`
- **Detailed Docs:** `docs/CI.md`
- **Setup Guide:** `.github/WORKFLOW_SETUP.md`
- **Actions Dashboard:** [GitHub Actions Tab](../../actions)

## 💡 Tips

1. **Before pushing:** Always run `pnpm test:ci`
2. **Skip CI:** Add `[skip ci]` to commit message
3. **View coverage:** Open `coverage/html/index.html` in browser
4. **Debug failures:** Check Actions tab for detailed logs
5. **Download reports:** Available in Actions artifacts (30 days)

## 🛠️ Customization

### Change Coverage Colors

Edit `.github/workflows/main.yaml` → `Determine coverage color` step:

```yaml
- name: Determine coverage color
  run: |
    if [ $COVERAGE -ge 90 ]; then
      echo "color=brightgreen"
    # ... customize thresholds ...
```

### Modify Badge Format

Edit the badge URL pattern in the `Update README badges` step.

### Add More Checks

Add steps before the `Build project` step:

```yaml
- name: Run linter
  run: pnpm lint

- name: Security audit
  run: pnpm audit
```

---

**Status:** ✅ Fully configured and ready to use!

Push your changes to see it in action. 🚀

