# CI/CD Pipeline Documentation

## Overview

The redisX project uses GitHub Actions for continuous integration and deployment. The main workflow automatically runs tests, builds the project, and updates README badges on every push and pull request.

## Workflow: `main.yaml`

**Location:** `.github/workflows/main.yaml`

### Triggers

- **Push** to `main` branch
- **Pull requests** targeting `main` branch

### Jobs

#### `test-and-build`

This job runs on `ubuntu-latest` and performs the following steps:

##### 1. Environment Setup
- Checks out the code
- Sets up Node.js 20
- Installs and configures pnpm
- Caches pnpm dependencies for faster builds

##### 2. Code Quality
- **Type Check:** Runs `pnpm typecheck` to ensure TypeScript types are valid

##### 3. Testing & Coverage
- **Run Tests:** Executes `pnpm coverage` to run all tests with coverage reporting
- **Parse Coverage:** Extracts coverage percentage from `coverage/coverage-summary.json`
- **Determine Color:** Assigns badge colors based on coverage percentage:
  - 90%+ → `brightgreen`
  - 80-89% → `green`
  - 70-79% → `yellow`
  - 60-69% → `orange`
  - <60% → `red`

##### 4. Build
- **Build Project:** Runs `pnpm build` to compile the TypeScript source

##### 5. Badge Updates (Main Branch Only)
When pushing to the `main` branch, the workflow automatically updates README badges:

- **Test Status Badge:**
  - ✅ `passing` (brightgreen) if all tests pass
  - ❌ `failing` (red) if any test fails

- **Coverage Badge:**
  - Shows actual coverage percentage
  - Color-coded based on coverage thresholds

The workflow commits these changes with the message `"chore: update test and coverage badges [skip ci]"` to prevent triggering another CI run.

##### 6. Artifacts
- **Coverage Reports:** Uploaded as artifacts for 30 days
- Accessible from the GitHub Actions interface

### Badge Format

The badges use shields.io format and appear at the top of the README:

```markdown
![Tests](https://img.shields.io/badge/tests-passing-brightgreen)
![Coverage](https://img.shields.io/badge/coverage-95%25-brightgreen)
```

## Local Testing

To run the same checks locally:

```bash
# Type check
pnpm typecheck

# Run tests with coverage
pnpm coverage

# Build project
pnpm build
```

## Coverage Configuration

Coverage is configured in `vitest.config.ts` with the following thresholds:

| Metric      | Threshold |
|-------------|-----------|
| Statements  | 95%       |
| Branches    | 90%       |
| Functions   | 95%       |
| Lines       | 95%       |

Coverage reports are generated in multiple formats:
- **text:** Console output
- **json:** Machine-readable format
- **json-summary:** Used by CI for badge generation
- **html:** Interactive HTML report

## Permissions

The workflow requires:
- `contents: write` - To commit badge updates to README
- `pull-requests: write` - To comment on PRs (future feature)

## Skipping CI

To skip the CI workflow, include `[skip ci]` in your commit message:

```bash
git commit -m "docs: update README [skip ci]"
```

## Troubleshooting

### Badges not updating

1. **Check workflow run:** Verify the workflow completed successfully
2. **Branch check:** Badges only update on `main` branch pushes
3. **Coverage file:** Ensure `coverage/coverage-summary.json` is generated
4. **Permissions:** Verify the workflow has write permissions

### Tests failing in CI but passing locally

1. **Node version:** Ensure you're using Node 20
2. **Dependencies:** Run `pnpm install --frozen-lockfile`
3. **Environment:** Check for environment-specific issues
4. **Cache:** Clear pnpm cache if needed

### Coverage reports not generated

1. **Vitest config:** Verify `reporter: ['text', 'json', 'json-summary', 'html']` is set
2. **Coverage provider:** Ensure `@vitest/coverage-v8` is installed
3. **Run coverage:** Use `pnpm coverage` not `pnpm test`

## Future Enhancements

Planned improvements for the CI pipeline:

- [ ] Add lint and format checks
- [ ] Matrix testing across Node 18, 20, 22
- [ ] Integration tests with Redis container
- [ ] Automated release workflow with changesets
- [ ] PR comments with coverage diff
- [ ] Performance benchmarking
- [ ] Security scanning (npm audit, Snyk)
- [ ] Automated dependency updates (Dependabot/Renovate)

## Related Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
- [RESP3.md](./RESP3.md) - RESP3 protocol implementation

