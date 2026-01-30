# OpenCode Usage Monitor

Real-time Claude rate limit monitoring alongside OpenCode using tmux.

```
┌─────────────────────────────────┬────────────────┐
│                                 │ Claude Limits  │
│         opencode                │ ────────────── │
│                                 │ 5h:  ████░ 44% │
│         (main TUI)              │ 7d:  █░░░░  4% │
│                                 │                │
│                                 │ User: Duchang  │
│                                 │ Plan: Max      │
└─────────────────────────────────┴────────────────┘
```

## Quick Start

```bash
# One-command setup (installs tmux, bun, opencode if needed)
curl -fsSL https://raw.githubusercontent.com/user/opencode-usage-monitor/main/bin/setup | bash

# Or manual setup
bun install -g opencode-usage-monitor

# Start opencode with monitor
opencode-with-monitor
```

## Features

- **Real-time Rate Limits**: 5-hour and 7-day usage windows
- **Profile Info**: User, organization, and plan badges (Pro/Max/Enterprise)
- **Auto-refresh**: Updates every 30 seconds
- **tmux Integration**: Seamless side-by-side with OpenCode
- **Plugin Toggle**: `/monitor toggle` to show/hide monitor pane from within OpenCode

## Installation

### Prerequisites

- **tmux**: Terminal multiplexer
- **bun**: JavaScript runtime
- **opencode**: AI coding assistant

### Automatic Setup

```bash
# Run the setup script
usage-monitor-setup
```

The setup script will:

1. Check for missing dependencies
2. Offer to install them automatically
3. Configure everything for you

### Manual Installation

```bash
# 1. Install tmux
brew install tmux       # macOS
sudo apt install tmux   # Ubuntu/Debian
sudo dnf install tmux   # Fedora

# 2. Install bun (if not installed)
curl -fsSL https://bun.sh/install | bash

# 3. Install opencode
bun install -g opencode

# 4. Install usage-monitor
bun install -g opencode-usage-monitor
```

## Usage

### Start OpenCode with Monitor

```bash
# Default: monitor on right side (25% width)
opencode-with-monitor

# Wider monitor pane (30%)
opencode-with-monitor -w 30

# Monitor on left side
opencode-with-monitor -l

# Custom session name
opencode-with-monitor -s myproject

# Pass arguments to opencode
opencode-with-monitor -- --model opus

# Kill existing session and restart
opencode-with-monitor -k
```

### Generic: Any Command with Monitor

```bash
# Run any command with monitor
with-monitor -- opencode
with-monitor -- nvim .
with-monitor -- zsh

# Options
with-monitor -w 30 -- opencode        # wider monitor
with-monitor -l -- opencode           # monitor on left
with-monitor -s myproject -- opencode # custom session name
```

### Inside OpenCode (Plugin Commands)

Once opencode is running inside tmux with the plugin:

```
/monitor toggle           # Show/hide the rate limit monitor pane
/monitor status           # Check tmux/monitor status
/monitor setup            # Show setup instructions
/monitor help             # Show help
```

Or simply ask the agent: "show the rate limit monitor"

## tmux Basics

If you're new to tmux, here are the essential commands:

| Shortcut      | Action                  |
| ------------- | ----------------------- |
| `Ctrl+b %`    | Split pane horizontally |
| `Ctrl+b "`    | Split pane vertically   |
| `Ctrl+b o`    | Switch between panes    |
| `Ctrl+b x`    | Close current pane      |
| `Ctrl+b d`    | Detach from session     |
| `Ctrl+b [`    | Scroll mode (q to exit) |
| `tmux attach` | Reattach to session     |

### Session Management

```bash
# List sessions
tmux list-sessions

# Attach to specific session
tmux attach -t opencode

# Kill a session
tmux kill-session -t opencode
```

## Configuration

### Environment Variables

| Variable                         | Description                | Default  |
| -------------------------------- | -------------------------- | -------- |
| `ANTHROPIC_ADMIN_API_KEY`        | Admin API key (org usage)  | -        |
| `USAGE_MONITOR_WIDTH`            | Monitor pane width (%)     | 25       |
| `USAGE_MONITOR_SESSION`          | tmux session name          | opencode |
| `USAGE_MONITOR_REFRESH_INTERVAL` | Refresh interval (seconds) | 30       |

See `.env.example` for all available variables and setup instructions.

### Config File

Create `~/.config/usage-monitor/config.yaml`:

```yaml
oauth:
  enabled: true
  show_profile: true

display:
  refresh_interval: 30

widget:
  width: 52
  style: rounded
```

## Authentication

The monitor automatically loads credentials from:

1. **OpenCode** (primary): `~/.local/share/opencode/auth.json`
2. **Claude Code** (fallback): `~/.claude/.credentials.json`

To authenticate:

```bash
opencode auth login
```

## Display

The monitor shows:

```
╭──────────── Claude Rate Limits ────────────╮
│ User: Duchang                              │
│ Org:  duchang.dev@gmail.com's Organization │
│ Plan: MAX                                  │
├────────────────────────────────────────────┤
│ 5-Hour:  ━━━━━━━━░░░░░░░░░░  44% (3h 1m)   │
│ 7-Day:   ━░░░░░░░░░░░░░░░░░   4% (166h 1m) │
├────────────────────────────────────────────┤
│ Updated: 2:30:15 AM                        │
╰────────────────────────────────────────────╯
```

## Troubleshooting

### "tmux is required but not installed"

Install tmux:

```bash
brew install tmux      # macOS
sudo apt install tmux  # Ubuntu
```

### "opencode is required but not installed"

Install opencode:

```bash
bun install -g opencode
opencode auth login
```

### "Session already exists"

Either attach to it or kill and restart:

```bash
# Attach to existing
opencode-with-monitor -a

# Or kill and restart
opencode-with-monitor -k
```

### Monitor not showing data

1. Check authentication: `opencode auth login`
2. Verify credentials exist: `cat ~/.local/share/opencode/auth.json`
3. Test manually: `usage-monitor --once`

## Development

```bash
# Clone the repo
git clone https://github.com/user/opencode-usage-monitor
cd opencode-usage-monitor

# Install dependencies
bun install

# Build
bun run build

# Run locally
bun run cli --once

# Type check
bun run typecheck

# Lint
bun run lint
```

### Testing

```bash
# Run all E2E tests
bun run test:e2e

# Run E2E tests in Docker (isolated environment)
bun run test:e2e:docker

# Generate JSON test report
./scripts/e2e.sh report

# Start mock OAuth server for manual testing
bun run mock-server

# Run specific scenario
SCENARIO=highUsage bun run mock-server
```

Available test scenarios: `healthy`, `lowUsage`, `highUsage`, `rateLimited`, `authError`, `enterpriseOrg`, `noLimits`, `slowResponse`, `serverError`

## License

MIT
