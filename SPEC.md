# Agentic Usage Monitor - Technical Specification

> **Translation Available**: [한국어 버전 (Korean)](./SPEC.ko.md)
> **Note**: When updating this document, please update the Korean translation as well.

## 1. Overview

**Agentic Usage Monitor** is a tmux-based real-time monitoring tool for AI coding agent usage and rate limits. It creates a tmux session with a compact usage monitor pane (1–3 lines) at the top or bottom, allowing developers to run any AI coding agent (OpenCode, Claude Code, etc.) in the main pane while continuously monitoring their rate limits.

```
┌──────────────────────────────────────────┐
│  Main Pane                               │
│  (OpenCode / Claude Code / shell)        │
│                                          │
│                                          │
├──────────────────────────────────────────┤
│ 5h:━━━━━━44% │ 7d:━━12% │ MAX  ↻ 3h12m │  ← Monitor Pane (1–3 lines)
└──────────────────────────────────────────┘
```

### Project Identity

- **Current Name**: `opencode-usage-monitor`
- **Target Name**: `agentic-usage-monitor`
- **CLI Command**: `usage-monitor`
- **Package**: `agentic-usage-monitor` (npm/bun)

## 2. Problem Statement

Developers using AI coding agents in the terminal face these challenges:

1. **Invisible Rate Limits**: No easy way to know current usage without leaving the terminal
2. **Surprise Throttling**: Hit rate limits unexpectedly, disrupting development flow
3. **Context Switching**: Must open browser/app to check usage status
4. **No Persistent Display**: Usage info is ephemeral, not continuously visible

### Current Workarounds

| Workaround                    | Problem                            |
| ----------------------------- | ---------------------------------- |
| Check claude.ai settings page | Requires context switch to browser |
| Wait for rate limit error     | Reactive, not proactive            |
| Mental estimation             | Inaccurate, causes anxiety         |

## 3. Goals

### Primary Goals

1. **tmux Session with Monitor Pane**: Automatically create a tmux session with a 1–3 line usage monitor pane at the top or bottom
2. **Non-intrusive Monitoring**: Monitor pane must never interfere with the main terminal workflow — minimal footprint (1–3 lines)
3. **At-a-glance Usage Display**: Show rate limit info (5-hour, 7-day windows) that is immediately comprehensible without cognitive overhead

### Secondary Goals

1. **Configurable Placement**: Top/bottom (1–3 lines, recommended default) and left/right (detail widget) positioning
3. **Extensible Architecture**: Provider interface for future AI agent support
4. **Easy Setup**: One-command installation and configuration

### Success Metrics

- User can see current usage at a glance without leaving terminal
- Monitor startup takes < 2 seconds
- Refresh updates complete in < 1 second
- Monitor pane occupies minimal screen space (1–3 lines for top/bottom)
- Works on macOS and Linux

## 4. Non-Goals

The following are explicitly **out of scope**:

| Non-Goal                         | Reason                                                  |
| -------------------------------- | ------------------------------------------------------- |
| Admin API / Organization billing | Complexity reduction; focus on personal rate limits     |
| GUI/Desktop application          | Terminal-native tool; GUI exists (Claude-Usage-Tracker) |
| Non-tmux terminal multiplexers   | tmux is the core dependency; others can be added later  |
| Real-time token counting         | Requires intercepting API calls; privacy concerns       |
| Multi-provider in v1             | Focus on Claude first; architecture supports extension  |

## 5. Target Users

### Primary: OpenCode Users

Developers who use [OpenCode](https://github.com/opencode-ai/opencode) as their terminal-based AI coding assistant.

**Characteristics**:

- Comfortable with terminal and tmux
- Use Claude (Pro/Max) subscription
- Want persistent rate limit visibility
- Value keyboard-driven workflows

### Secondary: Claude Code Users

Developers using Anthropic's official Claude Code CLI.

**Note**: Expansion to Claude Code is architecturally planned but not prioritized in v1.

## 6. Core Features

### 6.1 tmux Session Management

**Goal**: One command to start a tmux session with a monitor pane and main workspace.

**How it works**:

1. Create a tmux session with two panes: main pane + monitor pane
2. Monitor pane runs `usage-monitor` CLI in compact mode (auto-refresh)
3. Main pane runs the user's command (OpenCode, Claude Code, shell, etc.)
4. When the main command exits, the session is automatically cleaned up

**Pane Placement**:

- **Top/Bottom (recommended)**: 1–3 lines, compact display — the primary use case
- **Left/Right**: ~20% width, detailed widget with box drawing — for users who want more info

**Session Management**:

- Detect and handle existing sessions (attach, kill+restart, or error)
- Named panes ("main", "monitor") for programmatic control
- Graceful cleanup on exit

### 6.2 Rate Limit Display

**Goal**: User must be able to check their current rate limit status at a glance.

**Required Information**:

- Current utilization percentage for each rate limit window (5-hour, 7-day, etc.)
- Time remaining until each window resets
- User profile information (name, organization, plan type)

**Display Formats**:

- **Compact (1 line)**: `5h:━━━━44% │ 7d:━━12% │ MAX`
- **Compact (3 lines)**: Profile line + 5-hour bar + 7-day bar
- **Detail widget**: Full box with profile section, progress bars, reset times

**Design Principle**: Information should be immediately comprehensible without cognitive overhead.

### 6.3 Display Modes

#### Compact Pane (Default)

**Goal**: Minimal 1–3 line display at the top or bottom of the terminal.

- The primary and recommended mode
- Used automatically when position is top or bottom
- Shows essential usage info without visual clutter
- Does not interfere with the main terminal workflow at all

#### Detail Pane

**Goal**: Dedicated space for comprehensive usage information.

- Used when position is left or right
- Shows full widget with box drawing, profile info, progress bars, reset times
- ~20% of terminal width

### 6.4 Launcher Scripts

**Goal**: One-command startup with monitor pre-configured.

**Scripts**:

- `with-monitor`: Generic tmux launcher for any command (e.g., `with-monitor -- opencode`)

**Required Capabilities**:

- Start any command with monitor already visible
- Configure position via command-line options (`-t/--top`, `-b/--bottom`, `-l/--left`, `-r/--right`)
- Handle existing session conflicts gracefully

### 6.5 Configuration

**Goal**: Sensible defaults with customization options for power users.

**Configurable Aspects**:

- Refresh interval
- Display position and mode
- Visual styling preferences
- Profile display options

**Design Principle**: Zero configuration should work for most users. Default: bottom position, compact mode, 30s refresh.

## 7. Architecture

### 7.1 System Overview

```
┌─────────────────────────────────────────────────────────┐
│                      tmux Session                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Main Pane                                         │  │
│  │  (OpenCode / Claude Code / any terminal command)   │  │
│  │                                                    │  │
│  ├────────────────────────────────────────────────────┤  │
│  │  Monitor Pane (1–3 lines, compact)                │  │
│  │  5h:━━━━━━44% │ 7d:━━12% │ MAX         ↻ 3h12m   │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 7.2 Component Overview

```
┌────────────────────────────────────────────────────────────┐
│                    agentic-usage-monitor                     │
├────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐                                      │
│  │  Launcher Scripts │                                      │
│  │  (tmux session    │                                      │
│  │   management)     │                                      │
│  └────────┬─────────┘                                      │
│           │                                                 │
│           ▼                                                 │
│           ┌─────────────────┐    ┌────────────────────────┐  │
│           │   CLI           │    │   Provider Interface   │  │
│           │   (TUI render,  │───►│                        │  │
│           │    auto-refresh)│    │   - Claude Provider    │  │
│           └─────────────────┘    │   - Future providers   │  │
│                      ▲           └────────────────────────┘  │
│                      │                                       │
│           ┌─────────────────┐                                │
│           │   Monitor Core  │                                │
│           │   (scheduling,  │                                │
│           │    state mgmt)  │                                │
│           └─────────────────┘                                │
│                                                              │
└────────────────────────────────────────────────────────────┘
```

### 7.3 Provider Interface

**Goal**: Enable future support for multiple AI agent providers without major refactoring.

**Design Principle**:

- Each provider handles its own authentication and API communication
- Common interface for usage data regardless of provider
- v1 implements Claude only; interface design should not over-engineer for hypothetical providers

### 7.4 Data Flow

```
Launcher Script → tmux session → Monitor Pane → CLI Process
                                                      │
                                        Config ──► Monitor Core
                                                      │
                                        Credentials → Provider → OAuth API
                                                      │
                                              Monitor Core → TUI Renderer → Terminal Output
```

## 8. Technical Constraints

### 8.1 Requirements

| Requirement          | Specification                                |
| -------------------- | -------------------------------------------- |
| Terminal Multiplexer | **tmux (core dependency)**                   |
| Runtime              | Bun (Node.js compatible)                     |
| OS                   | macOS, Linux                                 |
| Authentication       | OpenCode/Claude Code OAuth credentials       |

### 8.2 Dependencies

**Design Principle**: Minimize dependencies. Only add what's strictly necessary.

| Category   | Package             | Purpose                    |
| ---------- | ------------------- | -------------------------- |
| Validation | zod                 | Config/response validation |
| Dev        | typescript, biome   | Type checking, linting     |

### 8.3 Credential Sources

Priority order for OAuth credentials:

1. **Claude Code**: `~/.claude/.credentials.json`
2. **OpenCode**: `~/.local/share/opencode/auth.json`
3. **Test**: `TEST_CREDENTIALS_PATH` environment variable

## 9. Removed Features

The following features from the current implementation will be **removed**:

### Admin API Integration

**Reason**: Complexity reduction. Focus on personal rate limits.

**Removed Components**:

- `src/data/admin-api.ts`
- `--api-only` CLI flag
- Organization billing/cost display
- `ANTHROPIC_ADMIN_API_KEY` support

**Migration**: Users needing org billing can use Anthropic Console or other tools.

## 10. Implementation Phases

### Phase 1: Core Cleanup (Current → v1.0) ✅

- [x] Remove Admin API components
- [x] Simplify configuration (remove admin-related options)
- [x] Update documentation
- [x] Rename project to `agentic-usage-monitor`

### Phase 2: tmux-centric Enhancement (v1.1)

- [x] Add top/bottom position support
- [x] Remove unused widget.width config (pane size is now fixed)
- [x] Compact mode for top/bottom panes (1-line display)
- [x] 3-line compact mode (profile + 5h + 7d)
- [ ] Add tmux status bar integration

### Phase 3: Polish (v1.2)

- [ ] Usage trend display (optional)
- [ ] Theme customization
- [ ] Notification support (threshold alerts)

### Phase 4: Extensibility (v2.0)

- [ ] Formalize Provider interface
- [ ] Documentation for adding providers
- [ ] Consider OpenAI/Gemini if demand exists

### Phase 5: User Experience (v2.1)

- [ ] Pane size persistence (remember resized pane across sessions)
- [ ] Mouse resize support with auto-save

## 11. Open Questions

| Question                        | Status | Notes                                |
| ------------------------------- | ------ | ------------------------------------ |
| Status bar format customization | TBD    | How much flexibility?                |
| Multiple provider display       | TBD    | Show all or active only?             |
| Notification mechanism          | TBD    | Terminal bell? Desktop notification? |
| Usage history/trends            | TBD    | Store locally? How much?             |

## 12. References

- [AGENTS.md](./AGENTS.md) - AI agent instructions
- [Claude-Usage-Tracker](https://github.com/hamed-elfayome/Claude-Usage-Tracker) - Reference macOS app
- [OpenCode](https://github.com/opencode-ai/opencode) - Primary integration target

---

**Document Version**: 1.1
**Last Updated**: 2026-02-10
**Authors**: Project maintainers
