# Agentic Usage Monitor

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
curl -fsSL https://raw.githubusercontent.com/user/agentic-usage-monitor/main/bin/setup | bash

# Or manual setup
bun install -g agentic-usage-monitor

# Start opencode with monitor
with-monitor -- opencode
```

## Features

- **Real-time Rate Limits**: 5-hour and 7-day usage windows
- **Profile Info**: User, organization, and plan badges (Pro/Max/Enterprise)
- **Auto-refresh**: Updates every 30 seconds
- **tmux Integration**: Seamless side-by-side with OpenCode

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
bun install -g agentic-usage-monitor
```

## Usage

### Start with Monitor

```bash
# Run any command with monitor
with-monitor -- opencode
with-monitor -- nvim .
with-monitor -- zsh

# Position options
with-monitor -l -- opencode           # monitor on left
with-monitor -r -- opencode           # monitor on right (default)
with-monitor -t -- opencode           # monitor on top (compact mode)
with-monitor -b -- opencode           # monitor on bottom (compact mode)
with-monitor -s myproject -- opencode # custom session name

# Pass arguments to command
with-monitor -- opencode --model opus

# Kill existing session and restart
with-monitor -k -- opencode
```

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
| `USAGE_MONITOR_SESSION`          | tmux session name          | opencode |
| `USAGE_MONITOR_REFRESH_INTERVAL` | Refresh interval (seconds) | 30       |

### Config File

Create `~/.config/usage-monitor/config.yaml`:

```yaml
oauth:
  enabled: true
  show_profile: true

display:
  refresh_interval: 30

widget:
  style: rounded
  position: right   # left, right, top, or bottom
  compact: false    # true for minimal single-line display
```

## Authentication

The monitor automatically loads credentials from:

1. **Claude Code** (primary): `~/.claude/.credentials.json`
2. **OpenCode** (fallback): `~/.local/share/opencode/auth.json`

No manual configuration needed. Credentials are detected automatically from Claude Code or OpenCode.

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
with-monitor -a -- opencode

# Or kill and restart
with-monitor -k -- opencode
```

### Monitor not showing data

1. Verify credentials exist: `ls ~/.claude/.credentials.json` or `ls ~/.local/share/opencode/auth.json`
2. Test manually: `usage-monitor --once`

## Development

```bash
# Clone the repo
git clone https://github.com/user/agentic-usage-monitor
cd agentic-usage-monitor

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
