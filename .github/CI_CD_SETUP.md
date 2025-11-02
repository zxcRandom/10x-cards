# CI/CD Setup - GitHub Actions

## Overview

This project uses GitHub Actions for automatic validation of Pull Requests to the `main` branch.

## Workflow: Pull Request Validation

File: `.github/workflows/pr-validation.yml`

### Triggers

The workflow runs automatically on every Pull Request to the `main` branch.

### Jobs

#### 1. Lint Code

- **Purpose**: Check code quality using ESLint
- **Commands**: `npm ci` → `npm run lint`
- **Duration**: ~1-2 minutes

#### 2. Unit Tests

- **Purpose**: Run unit tests
- **Commands**: `npm ci` → `npm run test:unit`
- **Duration**: ~1-2 minutes

#### 3. Build Check

- **Purpose**: Verify that the project builds correctly
- **Commands**: `npm ci` → `npm run build`
- **Duration**: ~2-3 minutes

#### 4. E2E Tests (optional - currently disabled)

- **Purpose**: End-to-end tests with Playwright
- **Status**: Disabled (`if: false`)
- **Requires**: Secrets configuration in GitHub

## Best Practices Applied

### ✅ Implemented in the project:

1. **Using `npm ci` instead of `npm install`**
   - Faster installation
   - Guarantees consistency with `package-lock.json`
   - Cleans `node_modules` before installation

2. **Node.js dependency caching**

   ```yaml
   uses: actions/setup-node@v4
   with:
     node-version: "20.x"
     cache: "npm"
   ```

   - Speeds up dependency installation
   - Reduces load on npm registry

3. **Pinning action versions to specific tags**
   - `actions/checkout@v5`
   - `actions/setup-node@v4`
   - Ensures stability and security

4. **Minimal required permissions**

   ```yaml
   permissions:
     contents: read
     pull-requests: write
   ```

5. **Parallel execution of independent jobs**
   - `lint`, `unit-tests`, and `build` run in parallel
   - Shortens total workflow execution time

6. **Dependency chain for E2E tests**

   ```yaml
   needs: [lint, unit-tests, build]
   ```

   - E2E tests run only if basic checks pass

7. **Upload artifacts for diagnostics**
   - Playwright reports are retained for 30 days
   - `if: always()` ensures upload even on errors

8. **Retry logic in Playwright**
   - Configuration in `playwright.config.ts`: `retries: process.env.CI ? 2 : 0`

## How to enable E2E tests in CI

### Step 1: Add Secrets in GitHub

1. Go to: `Settings` → `Secrets and variables` → `Actions`
2. Click `New repository secret`
3. Add the following secrets:
   - `PUBLIC_SUPABASE_URL`
   - `PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_KEY`

### Step 2: Enable E2E job

In file `.github/workflows/pr-validation.yml` change:

```yaml
if: false # Set to 'true' when you configure secrets in GitHub
```

to:

```yaml
if: true
```

### Step 3: (Optional) Create a dedicated test database

For security, consider using a separate Supabase instance for CI/CD tests.

## Testing workflow locally

You can test the workflow locally using [act](https://github.com/nektos/act):

```bash
# Install act (Windows)
choco install act-cli

# Run workflow
act pull_request
```

## Monitoring

- Check workflow status: `Actions` tab in GitHub
- Each PR shows the status of checks
- Click on "Details" to see logs

## Troubleshooting

### Problem: npm ci fails

**Solution**: Make sure `package-lock.json` is updated and committed.

### Problem: Build timeout

**Solution**: Increase timeout in workflow or optimize the build.

### Problem: E2E tests fail in CI

**Solution**:

1. Check that secrets are correctly configured
2. Run tests locally with `CI=true npm run test:e2e:fast`
3. Check artifact logs (Playwright report)

## Future Enhancements (TODO)

Possible improvements:

- [ ] Add coverage reporting (Codecov/Coveralls)
- [ ] Add security scanning (Dependabot, Snyk)
- [ ] Add performance budgets
- [ ] Matrix strategy for different Node.js versions
- [ ] Deploy preview for each PR (Vercel/Netlify)
- [ ] Automatic PR labeling
- [ ] Slack/Discord notifications
