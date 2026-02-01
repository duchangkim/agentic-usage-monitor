# Agentic Usage Monitor - Technical Specification

> **Translation Available**: [한국어 버전 (Korean)](./SPEC.ko.md)  
> **Note**: When updating this document, please update the Korean translation as well.

## 1. Overview

**Agentic Usage Monitor** is a terminal-based real-time monitoring tool for AI coding agent usage and rate limits. It runs alongside terminal-based AI coding assistants (OpenCode, Claude Code, etc.) using tmux, providing developers with continuous visibility into their usage without interrupting their workflow.

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

1. **Real-time Visibility**: Display rate limit usage continuously in terminal
2. **Zero Interruption**: Monitor without disrupting coding workflow
3. **Flexible Placement**: Show monitor where user wants (top/bottom/left/right)
4. **Compact Mode**: Minimal single-line display that doesn't interfere with terminal usage

### Secondary Goals

1. **OpenCode Integration**: First-class plugin support for OpenCode
2. **Extensible Architecture**: Provider interface for future AI agent support
3. **Easy Setup**: One-command installation and configuration

### Success Metrics

- User can see current usage at a glance without leaving terminal
- Monitor startup takes < 2 seconds
- Refresh updates complete in < 1 second
- Works on macOS and Linux

## 4. Non-Goals

The following are explicitly **out of scope**:

| Non-Goal                         | Reason                                                  |
| -------------------------------- | ------------------------------------------------------- |
| Admin API / Organization billing | Complexity reduction; focus on personal rate limits     |
| GUI/Desktop application          | Terminal-native tool; GUI exists (Claude-Usage-Tracker) |
| Non-tmux terminal multiplexers   | tmux is most common; others can be added later          |
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

### 6.1 Rate Limit Display

**Goal**: User must be able to check their current rate limit status at a glance.

**Required Information**:

- Current utilization percentage for each rate limit window (5-hour, 7-day, etc.)
- Time remaining until each window resets
- User profile information (name, organization, plan type)

**Design Principle**: Information should be immediately comprehensible without cognitive overhead.

### 6.2 Display Modes

#### Pane Mode

**Goal**: Dedicated space for detailed usage information.

- User can position the monitor pane in any direction (top/bottom/left/right)
- Pane size should be configurable
- Must not interfere with the main terminal workflow

#### Compact Mode (Status Bar)

**Goal**: Minimal single-line display that doesn't interfere with terminal usage.

- Display essential usage info in tmux status bar
- Must be unobtrusive while still providing at-a-glance visibility
- User should be able to quickly check usage without any context switch

### 6.3 OpenCode Plugin

**Goal**: Users can control the monitor from within OpenCode using natural commands.

**Required Capabilities**:

- Toggle monitor visibility (show/hide)
- Check current status
- Get setup help

**Design Principle**: Should work with both slash commands and natural language requests to the agent.

### 6.4 Launcher Scripts

**Goal**: One-command startup with monitor pre-configured.

**Required Capabilities**:

- Start OpenCode (or any command) with monitor already visible
- Configure position and size via command-line options
- Handle existing session conflicts gracefully

### 6.5 Configuration

**Goal**: Sensible defaults with customization options for power users.

**Configurable Aspects**:

- Refresh interval
- Display position and mode
- Visual styling preferences
- Profile display options

**Design Principle**: Zero configuration should work for most users.

## 7. Architecture

### 7.1 Component Overview

```
┌────────────────────────────────────────────────────────────┐
│                    agentic-usage-monitor                   │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌─────────────────┐     ┌─────────────────────────────┐   │
│  │   CLI           │     │   OpenCode Plugin           │   │
│  │   (standalone)  │◄────│   (tmux control)            │   │
│  └────────┬────────┘     └─────────────────────────────┘   │
│           │                                                │
│  ┌────────▼────────┐     ┌─────────────────────────────┐   │
│  │   Monitor Core  │────►│   Provider Interface        │   │
│  │   (scheduling,  │     │                             │   │
│  │    state mgmt)  │     │   - Claude Provider (v1)    │   │
│  └─────────────────┘     │   - Future providers...     │   │
│                          └─────────────────────────────┘   │
└────────────────────────────────────────────────────────────┘
```

### 7.2 Provider Interface

**Goal**: Enable future support for multiple AI agent providers without major refactoring.

**Design Principle**:

- Each provider handles its own authentication and API communication
- Common interface for usage data regardless of provider
- v1 implements Claude only; interface design should not over-engineer for hypothetical providers

### 7.3 Data Flow

```
Credentials → Provider → Monitor Core → Renderer (TUI)
                              ↑
                           Config
```

## 8. Technical Constraints

### 8.1 Requirements

| Requirement          | Specification                          |
| -------------------- | -------------------------------------- |
| Runtime              | Bun (Node.js compatible)               |
| Terminal Multiplexer | tmux (required)                        |
| OS                   | macOS, Linux                           |
| Authentication       | OpenCode/Claude Code OAuth credentials |

### 8.2 Dependencies

**Design Principle**: Minimize dependencies. Only add what's strictly necessary.

| Category   | Package             | Purpose                    |
| ---------- | ------------------- | -------------------------- |
| Validation | zod                 | Config/response validation |
| Plugin     | @opencode-ai/plugin | OpenCode integration       |
| Dev        | typescript, biome   | Type checking, linting     |

### 8.3 Credential Sources

Priority order for OAuth credentials:

1. **OpenCode**: `~/.local/share/opencode/auth.json`
2. **Claude Code**: `~/.claude/.credentials.json`
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

### Phase 1: Core Cleanup (Current → v1.0)

- [ ] Remove Admin API components
- [ ] Simplify configuration (remove admin-related options)
- [ ] Update documentation
- [ ] Rename project to `agentic-usage-monitor`

### Phase 2: Position Enhancement (v1.1)

- [ ] Add top/bottom position support
- [ ] Implement compact mode for pane
- [ ] Add tmux status bar integration

### Phase 3: Polish (v1.2)

- [ ] Usage trend display (optional)
- [ ] Theme customization
- [ ] Notification support (threshold alerts)

### Phase 4: Extensibility (v2.0)

- [ ] Formalize Provider interface
- [ ] Documentation for adding providers
- [ ] Consider OpenAI/Gemini if demand exists

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

**Document Version**: 1.0  
**Last Updated**: 2026-02-01  
**Authors**: Project maintainers
