# AGENTS.md - OpenCode Usage Monitor Plugin

## Project Overview

This is an OpenCode plugin for monitoring LLM API usage and costs across major providers:

- **Anthropic** (Claude)
- **OpenAI** (GPT-4, GPT-4o, etc.)
- **Google** (Gemini/Vertex AI)
- **OpenRouter**

The plugin tracks token consumption, estimated costs, and displays usage statistics within OpenCode sessions.

## Tech Stack

- **Runtime**: Bun (OpenCode's native runtime)
- **Language**: TypeScript (strict mode)
- **Framework**: @opencode-ai/plugin
- **Package Manager**: Bun (bun.lock)

## Build / Lint / Test Commands

```bash
# Install dependencies
bun install

# Type check
bun run typecheck
# or directly:
bunx tsc --noEmit

# Build (compile TypeScript)
bun run build

# Lint (using Biome - recommended for OpenCode ecosystem)
bun run lint
bunx @biomejs/biome check .

# Format
bun run format
bunx @biomejs/biome format --write .

# Run tests
bun test

# Run single test file
bun test src/providers/anthropic.test.ts

# Run tests matching pattern
bun test --grep "usage"

# Watch mode
bun test --watch

# Local development - install to opencode plugins directory
bun run install:local
# or manually:
cp dist/index.js ~/.config/opencode/plugins/usage-monitor.js
```

## Project Structure

```
opencode-usage-monitor/
├── src/
│   ├── index.ts              # Plugin entry point, exports Plugin function
│   ├── types.ts              # Shared TypeScript types
│   ├── providers/            # Provider-specific usage fetchers
│   │   ├── anthropic.ts
│   │   ├── openai.ts
│   │   ├── google.ts
│   │   └── openrouter.ts
│   ├── utils/
│   │   ├── cache.ts          # Rate limiting and caching
│   │   ├── format.ts         # Display formatting helpers
│   │   └── config.ts         # Config file handling
│   └── hooks/                # OpenCode event hooks
│       └── session.ts
├── package.json
├── tsconfig.json
├── biome.json
└── AGENTS.md
```

## Code Style Guidelines

### TypeScript

```typescript
// ALWAYS use strict TypeScript - no implicit any
// tsconfig.json should have:
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}

// GOOD: Explicit types for public APIs
export interface UsageData {
  provider: string
  inputTokens: number
  outputTokens: number
  totalCost: number
  currency: string
  period: { start: Date; end: Date }
}

// BAD: Avoid 'any' - use 'unknown' if type is truly unknown
function process(data: any) { }  // Never do this
function process(data: unknown) { }  // Prefer this, then narrow
```

### Imports

```typescript
// Order: 1) External packages, 2) @opencode-ai packages, 3) Relative imports
// Use type imports when importing only types

import { z } from "zod";
import type { Plugin, PluginInput, Hooks } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin";

import type { UsageData } from "./types";
import { formatCurrency } from "./utils/format";
```

### Plugin Structure

```typescript
// src/index.ts - Standard plugin entry point
import type { Plugin, PluginInput, Hooks } from "@opencode-ai/plugin";

export const UsageMonitorPlugin: Plugin = async (ctx: PluginInput) => {
  const { project, client, $, directory, worktree } = ctx;

  // Initialize plugin state here

  return {
    // Event hooks
    event: async ({ event }) => {
      if (event.type === "session.idle") {
        // Handle session completion
      }
    },

    // Tool execution hooks
    "tool.execute.before": async (input, output) => {
      // Intercept before tool runs
    },

    "tool.execute.after": async (input, output) => {
      // Process after tool completes
    },

    // Custom tools (optional)
    tool: {
      usage: tool({
        description: "Show LLM usage statistics",
        args: {
          provider: tool.schema.string().optional(),
          days: tool.schema.number().default(7),
        },
        async execute(args, context) {
          // Implementation
          return "Usage data here";
        },
      }),
    },
  } satisfies Partial<Hooks>;
};

// Default export for npm package compatibility
export default UsageMonitorPlugin;
```

### Error Handling

```typescript
// Use explicit error types, never swallow errors silently
import { NamedError } from "@opencode-ai/util/error";

class UsageApiError extends Error {
  constructor(
    public provider: string,
    public statusCode: number,
    message: string
  ) {
    super(`[${provider}] ${message}`);
    this.name = "UsageApiError";
  }
}

// GOOD: Explicit error handling with logging
async function fetchUsage(provider: string): Promise<UsageData> {
  try {
    const response = await fetch(endpoint);
    if (!response.ok) {
      throw new UsageApiError(provider, response.status, await response.text());
    }
    return response.json();
  } catch (error) {
    await client.app.log({
      service: "usage-monitor",
      level: "error",
      message: `Failed to fetch ${provider} usage`,
      extra: { error: String(error) },
    });
    throw error;
  }
}
```

### Naming Conventions

```typescript
// Files: kebab-case
// src/providers/open-router.ts

// Types/Interfaces: PascalCase
interface ProviderConfig {}
type UsageResponse = {};

// Functions/Variables: camelCase
function fetchAnthropicUsage() {}
const tokenCount = 0;

// Constants: SCREAMING_SNAKE_CASE
const DEFAULT_CACHE_TTL = 60_000;
const MAX_RETRY_ATTEMPTS = 3;

// Plugin exports: PascalCase with 'Plugin' suffix
export const UsageMonitorPlugin: Plugin = async (ctx) => {};
```

### Configuration

```typescript
// Use Zod for runtime validation of config
import { z } from "zod";

const ConfigSchema = z.object({
  providers: z
    .object({
      anthropic: z
        .object({
          apiKey: z.string().optional(),
          enabled: z.boolean().default(true),
        })
        .optional(),
      openai: z
        .object({
          apiKey: z.string().optional(),
          organizationId: z.string().optional(),
          enabled: z.boolean().default(true),
        })
        .optional(),
    })
    .optional(),
  refreshInterval: z.number().min(60).default(300), // seconds
  displayCurrency: z.enum(["USD", "EUR", "KRW"]).default("USD"),
});

type Config = z.infer<typeof ConfigSchema>;
```

### Logging

```typescript
// Use client.app.log() for structured logging, NOT console.log
await client.app.log({
  service: "usage-monitor",
  level: "info", // debug | info | warn | error
  message: "Fetched usage data",
  extra: {
    provider: "anthropic",
    tokenCount: 1500,
  },
});
```

### Testing

```typescript
// src/providers/anthropic.test.ts
import { describe, it, expect, mock, beforeEach } from "bun:test";
import { fetchAnthropicUsage } from "./anthropic";

describe("Anthropic Usage", () => {
  beforeEach(() => {
    // Reset mocks
  });

  it("should fetch usage data successfully", async () => {
    const mockResponse = {
      /* ... */
    };
    mock.module("./anthropic", () => ({
      fetchAnthropicUsage: mock(() => Promise.resolve(mockResponse)),
    }));

    const result = await fetchAnthropicUsage("test-key");
    expect(result.totalTokens).toBeGreaterThan(0);
  });

  it("should handle API errors gracefully", async () => {
    // Test error scenarios
  });
});
```

## OpenCode Plugin Events Reference

Available events to hook into:

| Event                  | Description               |
| ---------------------- | ------------------------- |
| `session.created`      | New session started       |
| `session.updated`      | Session state changed     |
| `session.idle`         | Session completed/waiting |
| `session.error`        | Session encountered error |
| `message.part.updated` | Message content updated   |
| `tool.execute.before`  | Before tool execution     |
| `tool.execute.after`   | After tool execution      |

## Provider API Integration Notes

### Anthropic

- Admin API: `https://admin.anthropic.com/v1/` (requires admin API key, not regular API key)
- Usage endpoint: `GET /organizations/{org_id}/usage`
- Billing page (fallback): Manual scraping not recommended

### OpenAI

- Usage API: `https://api.openai.com/v1/usage` (deprecated)
- Dashboard API: `https://api.openai.com/dashboard/` (unofficial)
- Consider using organization billing page data

### Google (Gemini/Vertex)

- Vertex AI pricing varies by region
- Use Google Cloud Billing API for accurate costs
- Requires OAuth2 service account credentials

### OpenRouter

- Usage API: `https://openrouter.ai/api/v1/auth/key`
- Returns credits remaining and usage history
- Simple API key authentication

## Dependencies

```json
{
  "dependencies": {
    "@opencode-ai/plugin": "latest",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.0",
    "@types/bun": "latest",
    "typescript": "^5.7.0"
  }
}
```

## Publishing to npm

```bash
# 1. Update version in package.json
# 2. Build
bun run build

# 3. Publish
npm publish --access public
```

Users install via `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-usage-monitor"]
}
```
