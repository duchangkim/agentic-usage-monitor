# agentic-usage-monitor

Real-time Claude rate limit terminal monitor. Bun + TypeScript.

## Commands

```bash
bun install          # Install
bun run build        # Build
bun run typecheck    # Type check
bun run lint         # Lint (biome)
bun run lint:fix     # Lint fix
bun test             # All tests
bun run test:e2e     # E2E tests
bun run cli --once   # Run once locally
```

## Safety

- No `as any`, `@ts-ignore`, `@ts-expect-error`
- Pre-commit: typecheck + lint must pass
