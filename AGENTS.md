# AGENTS.md - OpenCode Usage Monitor

## Project Overview

Real-time Claude rate limit monitoring tool that runs alongside OpenCode using tmux.

**Core Features:**

- OAuth-based rate limit tracking (5-hour, 7-day windows)
- Profile info display (user, organization, plan badges)
- Optional Admin API usage/cost tracking for organizations
- tmux integration for side-by-side display with OpenCode

## Tech Stack

- **Runtime**: Bun
- **Language**: TypeScript (strict mode)
- **Framework**: @opencode-ai/plugin (for OpenCode integration)
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
opencode-usage-monitor/
├── src/
│   ├── index.ts              # OpenCode plugin entry point
│   ├── cli/
│   │   └── index.ts          # Standalone CLI entry point
│   ├── config/
│   │   ├── index.ts          # Config exports
│   │   ├── loader.ts         # YAML config loader
│   │   └── schema.ts         # Zod validation schema
│   ├── data/
│   │   ├── index.ts          # Data layer exports
│   │   ├── admin-api.ts      # Anthropic Admin API client
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
│   │   ├── cli.test.ts       # CLI argument parsing
│   │   ├── tui.test.ts       # TUI rendering
│   │   ├── api.test.ts       # API response handling
│   │   └── tmux.test.ts      # tmux integration
│   ├── fixtures/
│   │   ├── scenarios.ts      # Mock data scenarios
│   │   └── credentials.json  # Test credentials
│   ├── harness/
│   │   ├── cli-runner.ts     # CLI execution wrapper
│   │   ├── assertions.ts     # Output verification
│   │   ├── reporter.ts       # JSON report generator
│   │   └── generate-report.ts
│   └── mock-server/
│       └── oauth-server.ts   # Mock OAuth API server
├── scripts/
│   ├── verify.sh             # Static analysis verification
│   └── e2e.sh                # E2E test runner script
├── Dockerfile                # Basic build environment
├── Dockerfile.e2e            # E2E test environment (with tmux)
├── docker-compose.yml        # Docker services
├── .env.example              # Environment variables template
└── AGENTS.md
```

## Testing Strategy

### Test Pyramid

1. **E2E Tests (Primary)**: Run actual CLI with mock OAuth server
2. **Integration Tests**: Test harness verifies CLI output
3. **Manual Verification**: Docker environment for agent verification

### E2E Test Categories

| Category         | File           | Coverage                                      |
| ---------------- | -------------- | --------------------------------------------- |
| CLI Arguments    | `cli.test.ts`  | --help, --once, --oauth-only flags            |
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
cat test-results/report.json
```

### Mock Server Scenarios

Available scenarios for testing different states:

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

## Agent Verification Workflow

### When Implementing Features

1. **Plan**: Include test scenarios in implementation plan
2. **Implement**: Write code changes
3. **Verify**: Run E2E tests before marking complete

```bash
# Quick verification
bun run test:e2e

# Full Docker verification
docker compose run --rm e2e
```

### When Fixing Bugs

1. **Reproduce**: Identify which scenario reproduces the bug
2. **Add Test**: Add test case that fails (if not exists)
3. **Fix**: Implement fix
4. **Verify**: Run tests, check JSON report

```bash
# Run specific test file
bun test test/e2e/tui.test.ts

# Check specific scenario output
./scripts/e2e.sh report
cat test-results/report.json | jq '.scenarios[] | select(.name == "once_healthy")'
```

### JSON Report Structure

```json
{
  "timestamp": "2026-01-29T12:42:17.494Z",
  "mode": "mocked",
  "environment": {
    "platform": "darwin",
    "bunVersion": "1.3.6",
    "docker": false
  },
  "summary": {
    "total": 6,
    "passed": 6,
    "failed": 0
  },
  "scenarios": [
    {
      "name": "once_healthy",
      "status": "pass",
      "duration": 46,
      "assertions": [...],
      "artifacts": {
        "stdout": "...",
        "stderr": ""
      }
    }
  ]
}
```

## OpenCode Plugin Testing

This project is an OpenCode plugin. Test in `plugin-test/` directory which uses project-level config.

### Setup & Test

```bash
# Install CLI globally (required for monitor pane)
bun link

# Start watch mode (auto-rebuilds on source changes)
bun run dev:plugin

# In another terminal, test in tmux
tmux new-session -s dev
cd plugin-test
opencode

# Inside OpenCode, ask agent to toggle monitor:
# "show the rate limit monitor"
# Or test directly:
opencode run "/monitor toggle"
opencode run "/monitor status"
```

### Plugin Commands

| Command | Description |
|---------|-------------|
| `/monitor toggle` | Show/hide the rate limit monitor pane |
| `/monitor status` | Check tmux and monitor status |
| `/monitor setup` | Show installation instructions |
| `/monitor help` | Show usage help |

### How It Works

1. `bun run dev:plugin` builds to `plugin-test/.opencode/plugins/usage-monitor.js` with watch mode
2. OpenCode auto-loads plugins from `.opencode/plugins/` directory (no config needed)
3. `/monitor toggle` creates/removes a tmux pane running `usage-monitor` CLI
4. `plugin-test/` is gitignored - isolated from development environment

### Requirements

- Must be running inside tmux session for toggle to work
- `usage-monitor` CLI must be installed globally (`bun link` or `bun install -g`)

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

### Environment Variables

Testability hooks via environment variables:

```typescript
// Production code should support test overrides
const OAUTH_API_BASE =
  process.env.OAUTH_API_BASE ?? "https://api.anthropic.com/api/oauth";
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
| `ANTHROPIC_ADMIN_API_KEY`        | No       | Admin API key for org usage     |
| `USAGE_MONITOR_REFRESH_INTERVAL` | No       | Refresh interval (default: 30s) |
| `USAGE_MONITOR_SESSION`          | No       | tmux session name               |
| `USAGE_MONITOR_WIDTH`            | No       | Monitor pane width %            |

Test-only variables:
| Variable | Description |
|----------|-------------|
| `OAUTH_API_BASE` | Override OAuth API URL |
| `TEST_CREDENTIALS_PATH` | Mock credentials path |
| `SCENARIO` | Mock server scenario |

## Verification Checklist

Before considering a task complete:

- [ ] `bun run typecheck` passes
- [ ] `bun run lint` passes
- [ ] `bun run test:e2e` passes (33 tests)
- [ ] If UI changed: verify with `bun run cli --once`
- [ ] If Docker config changed: `docker compose build e2e`

## API Reference

### OAuth API (Rate Limits)

```
GET /api/oauth/usage
GET /api/oauth/profile
Authorization: Bearer {oauth_token}
anthropic-beta: oauth-2025-04-20
```

### Admin API (Organization Usage)

```
GET /v1/organizations/cost_report
GET /v1/organizations/usage_report/claude_code
x-api-key: {admin_api_key}
```

## Authentication

Credentials are auto-loaded from:

1. **OpenCode**: `~/.local/share/opencode/auth.json`
2. **Claude Code**: `~/.claude/.credentials.json`

No manual configuration needed for OAuth rate limits.
