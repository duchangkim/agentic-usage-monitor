# Agentic Usage Monitor

Real-time Claude rate limit monitoring for AI coding agents (Claude Code, OpenCode) using tmux.

```
╭─────────────────── Claude Rate Limits ───────────────────╮
│                    ┌────────────────┐                    │
│                    │ Plenty of room │                    │
│                    └─┬──────────────┘                    │
│                         ▗▟███▙▖                          │
│                        ▐█ ◠ ◠ █▌                         │
│                        ▐█▄▄▄▄▄█▌                         │
│                         ▀█████▀                          │
├──────────────────────────────────────────────────────────┤
│ User: Duchang                                            │
│ Org:  duchang.dev@gmail.com's Organization               │
│ Plan: MAX                                                │
├──────────────────────────────────────────────────────────┤
│ 5-Hour: ━░░░░░░░░░░░░░░░░░░░░░░░░░░   4% (2h 22m)        │
│ 7-Day:  ━━━░░░░░░░░░░░░░░░░░░░░░░░░  10% (3d 19h)        │
├──────────────────────────────────────────────────────────┤
│ Updated: 11:11:11 PM                                     │
╰──────────────────────────────────────────────────────────╯

● Running | Refresh: 30s

q:exit  e:config  E:apply
```

## Installation

### Standalone Binary (macOS / Linux)

```bash
curl -fsSL https://raw.githubusercontent.com/duchangkim/agentic-usage-monitor/main/install.sh | sh
```

Detects OS/architecture, installs to `~/.local/bin/`, and verifies checksums.

### Windows (Experimental)

```powershell
irm https://raw.githubusercontent.com/duchangkim/agentic-usage-monitor/main/install.ps1 | iex
```

Installs to `%LOCALAPPDATA%\usage-monitor\` and adds to PATH. Requires PowerShell 5.1+.

> **Note:** Windows support is experimental. tmux is not available on Windows, so `launch` and agent subcommands use Windows Terminal pane splitting instead.

### Prerequisites

**tmux** is required for `launch` and agent subcommands (macOS/Linux only):

```bash
brew install tmux       # macOS
sudo apt install tmux   # Ubuntu/Debian
```

## Usage

### Agent Subcommands

One command launches both the agent and the monitor side by side:

```bash
usage-monitor claude     # Claude Code + claude-code credentials
usage-monitor opencode   # OpenCode + opencode credentials
```

### Launch with Any Command

```bash
usage-monitor launch -- opencode              # monitor on right (default)
usage-monitor launch -t -- opencode           # monitor on top
usage-monitor launch -b -- claude             # monitor on bottom
usage-monitor launch -l -- nvim .             # monitor on left
usage-monitor launch -s myproject -- opencode # named session
```

### Standalone Monitor

```bash
usage-monitor                     # auto-refresh mode (30s)
usage-monitor --once              # one-shot display
usage-monitor --compact           # minimal 3-line mode
usage-monitor --source opencode   # specific credential source
```

### Options

| Flag | Description |
| --- | --- |
| `--once`, `-1` | Show usage once and exit |
| `--compact` | Minimal display mode |
| `--source <src>` | Credential source: `auto` (default), `claude-code`, `opencode` |
| `--theme <name>` | Color theme (nord, dracula, github, etc.) |
| `--config <path>` | Path to config file |
| `--help`, `-h` | Show help |
| `--version`, `-v` | Show version |

### Self-update / Uninstall

```bash
usage-monitor update      # update to latest version
usage-monitor uninstall   # remove from system
```

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
bun test                  # all tests
bun run test:e2e          # E2E tests
bun run test:e2e:docker   # E2E in Docker (isolated)
bun run mock-server       # start mock OAuth server
```

## License

MIT
