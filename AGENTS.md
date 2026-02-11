# AGENTS.md - Agentic Usage Monitor

> **Specification**: Read [SPEC.md](./SPEC.md) for project goals, architecture, and decisions.  
> **Translation Maintenance**: When SPEC.md is updated, update [SPEC.ko.md](./SPEC.ko.md) (Korean translation) accordingly.

## Project Overview

Real-time Claude rate limit monitoring tool that runs alongside OpenCode using tmux.

**Package Name**: `agentic-usage-monitor`  
**CLI Command**: `usage-monitor`

**Core Features:**

- OAuth-based rate limit tracking (5-hour, 7-day windows)
- Profile info display (user, organization, plan badges)
- tmux integration for side-by-side display with OpenCode

## Tech Stack

- **Runtime**: Bun
- **Language**: TypeScript (strict mode)
- **Package Manager**: Bun (bun.lock)
- **Linter**: Biome

## Build / Lint / Test Commands

```bash
# Install dependencies
bun install

# Type check
bun run typecheck

# Build
bun run build

# Lint
bun run lint
bun run lint:fix

# Format
bun run format

# Run all tests
bun test

# Run E2E tests only
bun run test:e2e

# Run E2E tests in Docker (isolated environment)
bun run test:e2e:docker

# Generate E2E test report (JSON)
./scripts/e2e.sh report

# Start mock OAuth server for testing
bun run mock-server

# Run CLI locally
bun run cli --once
```

## Project Structure

```
agentic-usage-monitor/
├── src/
│   ├── cli/
│   │   └── index.ts          # Standalone CLI entry point
│   ├── config/
│   │   ├── index.ts          # Config exports
│   │   ├── loader.ts         # YAML config loader
│   │   └── schema.ts         # Zod validation schema
│   ├── data/
│   │   ├── index.ts          # Data layer exports
│   │   ├── oauth-api.ts      # OAuth API client (rate limits)
│   │   └── oauth-credentials.ts  # Credentials loader
│   ├── monitor/
│   │   ├── index.ts          # Monitor exports
│   │   └── oauth-monitor.ts  # Auto-refresh monitor
│   └── tui/
│       ├── index.ts          # TUI exports
│       ├── renderer.ts       # Box drawing, text rendering
│       ├── progress.ts       # Progress bar component
│       └── styles.ts         # ANSI styles
├── bin/
│   ├── opencode-with-monitor # tmux launcher for OpenCode
│   ├── with-monitor          # Generic tmux launcher
│   └── setup                 # Auto-install script
├── test/
│   ├── e2e/                  # E2E test scenarios
│   ├── fixtures/             # Mock data
│   ├── harness/              # Test utilities
│   └── mock-server/          # Mock OAuth API server
├── scripts/
│   ├── verify.sh             # Static analysis verification
│   └── e2e.sh                # E2E test runner script
├── SPEC.md                   # Technical specification (English)
├── SPEC.ko.md                # Technical specification (Korean)
└── AGENTS.md                 # This file
```

## Testing Strategy

### Test Pyramid

1. **E2E Tests (Primary)**: Run actual CLI with mock OAuth server
2. **Integration Tests**: Test harness verifies CLI output
3. **Manual Verification**: Docker environment for agent verification

### E2E Test Categories

| Category         | File           | Coverage                                      |
| ---------------- | -------------- | --------------------------------------------- |
| CLI Arguments    | `cli.test.ts`  | --help, --once flags                          |
| TUI Rendering    | `tui.test.ts`  | Box drawing, progress bars, responsive layout |
| API Handling     | `api.test.ts`  | Success, 401, 429, 500 responses              |
| tmux Integration | `tmux.test.ts` | Session creation, pane capture                |

### Running E2E Tests

```bash
# Local (fast feedback)
bun run test:e2e

# Docker (isolated, CI-like)
docker compose run --rm e2e

# With JSON report
./scripts/e2e.sh report
```

### Mock Server Scenarios

| Scenario        | Description                   |
| --------------- | ----------------------------- |
| `healthy`       | Normal usage (44% 5h, 12% 7d) |
| `lowUsage`      | Low usage, PRO user           |
| `highUsage`     | Near limits (85% 5h, 78% 7d)  |
| `rateLimited`   | 429 error response            |
| `authError`     | 401 error response            |
| `enterpriseOrg` | Enterprise organization user  |
| `noLimits`      | No rate limits active         |
| `slowResponse`  | 3 second delay                |
| `serverError`   | 500 error response            |

## Code Style Guidelines

### TypeScript

```typescript
// ALWAYS use strict TypeScript - no implicit any
// NEVER use: as any, @ts-ignore, @ts-expect-error

// GOOD: Explicit types for public APIs
export interface UsageData {
  fiveHour: RateLimitWindow | null;
  sevenDay: RateLimitWindow | null;
}

// BAD: Avoid 'any'
function process(data: any) {} // Never
function process(data: unknown) {} // Prefer, then narrow
```

### Imports

```typescript
// Order: 1) Node builtins, 2) External packages, 3) Relative imports
// Use type imports when importing only types

import { existsSync } from "node:fs";
import { z } from "zod";
import type { Config } from "./schema";
import { loadConfig } from "./loader";
```

### Error Handling

```typescript
// Use Result types for expected failures
export type OAuthApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: OAuthApiError };

// GOOD: Explicit error handling
const result = await api.getUsage();
if (!result.success) {
  // Handle error
  return;
}
// Use result.data
```

## Docker Services

| Service       | Purpose                | Command                              |
| ------------- | ---------------------- | ------------------------------------ |
| `e2e`         | Run E2E tests          | `docker compose run --rm e2e`        |
| `e2e-report`  | Generate JSON report   | `docker compose run --rm e2e-report` |
| `e2e-shell`   | Debug shell            | `docker compose run --rm e2e-shell`  |
| `mock-server` | Standalone mock server | `docker compose up mock-server`      |
| `verify`      | Static analysis        | `docker compose run --rm verify`     |

## Environment Variables

| Variable                         | Required | Description                     |
| -------------------------------- | -------- | ------------------------------- |
| `USAGE_MONITOR_REFRESH_INTERVAL` | No       | Refresh interval (default: 30s) |
| `USAGE_MONITOR_SESSION`          | No       | tmux session name               |

Test-only variables:

| Variable                | Description             |
| ----------------------- | ----------------------- |
| `OAUTH_API_BASE`        | Override OAuth API URL  |
| `TEST_CREDENTIALS_PATH` | Mock credentials path   |
| `SCENARIO`              | Mock server scenario    |

## Verification Checklist

Before considering a task complete:

- [ ] `bun run typecheck` passes
- [ ] `bun run lint` passes
- [ ] `bun run test:e2e` passes
- [ ] If UI changed: verify with `bun run cli --once`
- [ ] If Docker config changed: `docker compose build e2e`

## Git Workflow

### Commit Granularity

Commits should be made in **logical work units**, not by phase or file:

| Good Commit Unit | Bad Commit Unit |
| --- | --- |
| "Remove Admin API components" | "Phase 1 changes" |
| "Rename package to agentic-usage-monitor" | "Update all files" |
| "Update documentation for v1.0" | "Fix stuff" |

### Commit Message Format

```
<concise title describing the main change>

<optional body explaining why, not what>
- Use bullet points for multiple related changes
- Reference issues/specs if relevant
```

**Examples:**

```
Remove Admin API integration

- Delete admin-api.ts and related exports
- Simplify config schema (remove adminApiKey, showApiUsage)
- Update CLI to remove --api-only flag
```

```
Rename package to agentic-usage-monitor
```

### Pre-commit Verification

Before committing, ensure:

1. `bun run typecheck` passes
2. `bun run lint` passes (or `bun run lint:fix` to auto-fix)

These checks are also enforced by pre-commit hooks when configured.

### Using git-master Skill

For git operations, use the `git-master` skill via `delegate_task`:

```
delegate_task(
  category="quick",
  load_skills=["git-master"],
  prompt="Commit the Admin API removal changes with appropriate message"
)
```

This ensures:
- Atomic commits with proper granularity
- Consistent commit message format
- Proper use of git commands (no force push to main, etc.)

### Commit Timing

- Commit after completing each logical unit of work
- Do NOT batch unrelated changes into a single commit
- Do NOT wait until end of session to commit everything

## API Reference

### OAuth API (Rate Limits)

```
GET /api/oauth/usage
GET /api/oauth/profile
Authorization: Bearer {oauth_token}
anthropic-beta: oauth-2025-04-20
```

## Authentication

Credentials are auto-loaded from:

1. **OpenCode**: `~/.local/share/opencode/auth.json`
2. **Claude Code**: `~/.claude/.credentials.json`

No manual configuration needed for OAuth rate limits.
