# Agentic Usage Monitor

Real-time Claude rate limit monitoring for AI coding agents (Claude Code, OpenCode) using tmux.

```
┌──────────────────────────────────────────┐
│  Main Pane                               │
│  (Claude Code / OpenCode / shell)        │
│                                          │
├──────────────────────────────────────────┤
│ 5h:━━━━━━44% │ 7d:━━12% │ MAX  ↻ 3h12m   │  <- Monitor Pane
└──────────────────────────────────────────┘
```

## Quick Start

```bash
# Install standalone binary
curl -fsSL https://raw.githubusercontent.com/duchangkim/agentic-usage-monitor/main/install.sh | sh

# Launch Claude Code with usage monitor
usage-monitor claude

# Launch OpenCode with usage monitor
usage-monitor opencode
```

That's it. The monitor automatically detects credentials from your Claude Code or OpenCode login.

## Features

- **Agent Subcommands**: `usage-monitor claude` / `usage-monitor opencode` -- one command to launch
- **Multi-source Credentials**: `--source claude-code` or `--source opencode` to pick the right account
- **Real-time Rate Limits**: 5-hour, 7-day, and Opus 7-day usage windows
- **Profile Info**: User, organization, plan badges (PRO / MAX / ENT)
- **Auto-refresh**: Updates every 30 seconds
- **tmux Integration**: Compact monitor pane alongside your coding agent
- **Custom Agents**: Define your own agent + credential mappings via JSON config

## Installation

### Standalone Binary (Recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/duchangkim/agentic-usage-monitor/main/install.sh | sh
```

The installer detects your OS/architecture, downloads the binary to `~/.local/bin/`, and verifies checksums.

### From Source

```bash
# Requires: bun (https://bun.sh)
bun install -g agentic-usage-monitor
```

### Prerequisites

- **tmux** -- required for the `launch` and agent subcommands

```bash
brew install tmux       # macOS
sudo apt install tmux   # Ubuntu/Debian
```

## Usage

### Agent Subcommands

The simplest way to use the monitor -- one command launches both the agent and the monitor:

```bash
usage-monitor claude              # Claude Code + claude-code credentials
usage-monitor opencode            # OpenCode + opencode credentials
```

### Launch with Any Command

```bash
usage-monitor launch -- opencode              # monitor on right (default)
usage-monitor launch -t -- opencode           # monitor on top (compact)
usage-monitor launch -b -- claude             # monitor on bottom (compact)
usage-monitor launch -l -- nvim .             # monitor on left
usage-monitor launch -s myproject -- opencode # named session
```

### Standalone Monitor

```bash
usage-monitor                     # auto-refresh mode
usage-monitor --once              # one-shot display
usage-monitor --compact           # minimal 3-line mode
usage-monitor --source opencode   # use OpenCode credentials only
```

### Credential Source Selection

When you have multiple accounts (e.g., work Claude Code + personal OpenCode):

```bash
# Explicit source selection
usage-monitor --once --source claude-code   # Claude Code credentials only
usage-monitor --once --source opencode      # OpenCode credentials only
usage-monitor --once --source auto          # try all sources (default)

# Environment variable
USAGE_MONITOR_SOURCE=opencode usage-monitor --once
```

## Authentication

Credentials are loaded automatically in this priority order:

| Priority | Source                       | Path                                                          |
| -------- | ---------------------------- | ------------------------------------------------------------- |
| 1        | Claude Code (macOS Keychain) | `security find-generic-password -s "Claude Code-credentials"` |
| 2        | Claude Code (file)           | `~/.claude/.credentials.json`                                 |
| 3        | OpenCode                     | `~/.local/share/opencode/auth.json`                           |

Use `--source` to skip the fallback chain and use a specific source directly.

## Display

### Full Widget (left/right position)

```
╭──────────── Claude Rate Limits ────────────╮
│ User: Duchang                              │
│ Org:  Anthropic                            │
│ Plan: MAX                                  │
├────────────────────────────────────────────┤
│ 5-Hour: ━━━━━━━━░░░░░░░░  44% (3h 12m)     │
│ 7-Day:  ━░░░░░░░░░░░░░░░  12% (4d 23h)     │
│ Opus:   ━━░░░░░░░░░░░░░░   8% (4d 23h)     │
├────────────────────────────────────────────┤
│ Updated: 2:30:15 AM                        │
╰────────────────────────────────────────────╯
```

### Compact Mode (top/bottom position)

```
Duchang MAX
5h: ━━━━━━░░░░  44% (3h 12m)
7d: ━░░░░░░░░░  12% (4d 23h)
```

## Agent Configuration

Custom agent mappings can be defined in `~/.config/usage-monitor/agents.json`:

```json
{
  "agents": {
    "work": {
      "command": "claude",
      "credential": { "source": "claude-code" }
    },
    "personal": {
      "command": "opencode",
      "credential": { "source": "opencode" }
    }
  }
}
```

Then use: `usage-monitor work` or `usage-monitor personal`.

Default agents (`claude`, `opencode`) are always available without configuration.

## Configuration

### Environment Variables

| Variable                         | Description                                           | Default       |
| -------------------------------- | ----------------------------------------------------- | ------------- |
| `USAGE_MONITOR_SOURCE`           | Credential source (`auto`, `claude-code`, `opencode`) | `auto`        |
| `USAGE_MONITOR_SESSION`          | tmux session name                                     | `monitor-PID` |
| `USAGE_MONITOR_REFRESH_INTERVAL` | Refresh interval (seconds)                            | `30`          |

### Config File

Optional YAML config at `~/.config/usage-monitor/config.yaml`:

```yaml
oauth:
  enabled: true
  showProfile: true

display:
  refreshInterval: 30

widget:
  style: rounded # rounded, square, double, simple
  position: right # left, right, top, bottom
  compact: false
```

## tmux Basics

| Shortcut      | Action                  |
| ------------- | ----------------------- |
| `Ctrl+b %`    | Split pane horizontally |
| `Ctrl+b "`    | Split pane vertically   |
| `Ctrl+b o`    | Switch between panes    |
| `Ctrl+b d`    | Detach from session     |
| `tmux attach` | Reattach to session     |

## Troubleshooting

### Monitor not showing data

1. Check credentials exist:
   ```bash
   ls ~/.claude/.credentials.json
   ls ~/.local/share/opencode/auth.json
   ```
2. Test manually: `usage-monitor --once`
3. Try explicit source: `usage-monitor --once --source claude-code`

### "tmux is required but not installed"

```bash
brew install tmux      # macOS
sudo apt install tmux  # Ubuntu
```

### "Session already exists"

The monitor will automatically attach to the existing session.

## Development

```bash
git clone https://github.com/duchangkim/agentic-usage-monitor
cd agentic-usage-monitor

bun install          # install dependencies
bun run build        # build
bun run typecheck    # type check
bun run lint         # lint
bun run cli --once   # run locally
```

### Testing

```bash
bun run test:e2e                  # run all E2E tests
bun run test:e2e:docker           # run in Docker (isolated)
bun run mock-server               # start mock OAuth server
SCENARIO=highUsage bun run mock-server  # specific scenario
```

Test scenarios: `healthy`, `lowUsage`, `highUsage`, `rateLimited`, `authError`, `enterpriseOrg`, `noLimits`, `slowResponse`, `serverError`

## License

MIT
