# Agentic Usage Monitor - Technical Specification

> **Translation Available**: [한국어 버전 (Korean)](./SPEC.ko.md)
> **Note**: When updating this document, please update the Korean translation as well.

## 1. Overview

**Agentic Usage Monitor** is a tmux-based real-time monitoring tool for AI coding agent usage and rate limits. It creates a tmux session with a dedicated monitor pane, allowing developers to run any AI coding agent (OpenCode, Claude Code, etc.) in the main pane while continuously monitoring their rate limits.

The default mode features an **ASCII art character** that reacts to usage levels — changing expressions, playing subtle animations, and showing speech bubbles — adding emotional warmth to the terminal experience.

```
┌────────────────────────────────┬────────────┐
│  Main Pane                     │ ▗▟█████▙▖  │
│  (OpenCode / Claude Code)      │ ▐█ ◉ ◉ █▌  │
│                                │ ▐█▄▄▄▄▄█▌  │
│                                │  ▀█████▀   │
│                                │  "여유~"    │
│                                │            │
│                                │ 5h ━━━ 44% │
│                                │ 7d ━━  12% │
└────────────────────────────────┴────────────┘
         Default: Character Mode (right pane)
```

For minimal setups, a compact mode (1–3 lines, top/bottom) is also available without the character:

```
┌──────────────────────────────────────────┐
│  Main Pane                               │
│  (OpenCode / Claude Code / shell)        │
├──────────────────────────────────────────┤
│ 5h:━━━━━━44% │ 7d:━━12% │ MAX  ↻ 3h12m │  ← Compact Mode (no character)
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

1. **tmux Session with Monitor Pane**: Automatically create a tmux session with a monitor pane (character mode as default, compact mode as alternative)
2. **Non-intrusive Monitoring**: Monitor pane must never interfere with the main terminal workflow
3. **At-a-glance Usage Display**: Show rate limit info (5-hour, 7-day windows) that is immediately comprehensible without cognitive overhead
4. **Emotional Terminal Experience**: ASCII art character that reacts to usage state — making rate limit monitoring feel alive rather than clinical

### Secondary Goals

1. **Configurable Placement**: Top/bottom (1–3 lines, recommended default) and left/right (detail widget) positioning
2. **Extensible Architecture**: Provider interface for future AI agent support
3. **Easy Setup**: One-command installation and configuration

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

#### Character Mode (Default)

**Goal**: Usage monitoring with emotional connection through an ASCII art character.

- **The default and recommended mode**
- Used when position is left or right (default: right)
- Shows ASCII character + usage widget + speech bubbles
- Character reacts to usage levels (see §6.6 Character System)
- ~20–25% of terminal width

#### Compact Pane

**Goal**: Minimal 1–3 line display at the top or bottom of the terminal.

- Alternative mode for users who prefer minimal footprint
- Used when position is top or bottom
- Shows essential usage info without visual clutter — **no character**
- Does not interfere with the main terminal workflow at all

### 6.4 Launch Subcommand

**Goal**: One-command startup with monitor pre-configured.

**Command**: `usage-monitor launch` — built-in tmux launcher (e.g., `usage-monitor launch -- opencode`)

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

### 6.6 Character System

**Goal**: Bring warmth to terminal monitoring through expressive ASCII art characters.

#### Character States

Characters change appearance based on the **highest** usage percentage across all windows:

| State       | Usage Range  | Expression         | Example Mood        |
| ----------- | ------------ | ------------------ | ------------------- |
| `relaxed`   | 0–30%        | Happy, at ease     | Smiling, content    |
| `normal`    | 30–60%       | Neutral, attentive | Calm, working       |
| `concerned` | 60–80%       | Worried            | Nervous, sweating   |
| `critical`  | 80–100%      | Panicked, alarmed  | Stressed, frantic   |
| `rateLimit` | Rate limited | Exhausted, down    | Collapsed, sleeping |
| `error`     | API error    | Confused           | Question marks      |

#### Animation System

Each state has multiple **frames** (4–8 per state) that cycle at per-state intervals, with per-frame duration overrides for transient expressions like blinks:

```
Frame 1 (idle)     Frame 2 (blink)    Frame 3 (idle)     Frame 4 (wink)
   ▗▟███▙▖           ▗▟███▙▖          ▗▟███▙▖            ▗▟███▙▖
  ▐█ ◠ ◠ █▌         ▐█ ─ ─ █▌        ▐█ ◠ ◠ █▌          ▐█ ◠ ─ █▌
  ▐█▄▄▄▄▄█▌         ▐█▄▄▄▄▄█▌        ▐█▄▄▄▄▄█▌          ▐█▄▄▄▄▄█▌
   ▀█████▀           ▀█████▀          ▀█████▀             ▀█████▀
  [4000–6000ms]       [150ms]         [4000–6000ms]        [200ms]
```

**Per-state animation timing** — each usage level has a distinct rhythm:

| State       | Interval       | Frames | Feel                             |
| ----------- | -------------- | ------ | -------------------------------- |
| `relaxed`   | 4000–6000ms    | 8      | Slow, occasional blink and wink  |
| `normal`    | 3000–5000ms    | 6      | Focused, periodic blink          |
| `concerned` | 2500–4000ms    | 5      | Restless, glancing around        |
| `critical`  | 1500–2500ms    | 2      | Rapid alternation, urgency       |
| `rateLimit` | 5000–8000ms    | 6      | Sluggish, drowsy                 |
| `error`     | 2000–3500ms    | 4      | Confused, intermittent blink     |

**Per-frame duration overrides** (`frameDurations`) — transient expressions use short fixed durations instead of the state interval:

| Expression | Duration | Description                              |
| ---------- | -------- | ---------------------------------------- |
| Blink (──) | 150ms    | Natural eye-closing, barely perceptible  |
| Wink (◠─)  | 200ms    | Playful asymmetric blink                 |
| Glance (◔◔)| 300ms    | Brief sideways look                      |
| Drowsy (_ _)| 400ms   | Slow heavy-lidded droop (rate-limited)   |

**Timing resolution order**: `frameDurations[i]` > `state.timing` > `preset.defaultTiming` > constructor defaults (3–5s)

#### Speech Bubbles

Characters display short context-aware messages in speech bubbles:

```
  ┌──────────────┐
  │ 여유 있어요~    │
  └──┬───────────┘
     │
   ▗▟███▙▖
  ▐█ ◉ ◉ █▌
```

**Bubble behavior**:

- One message shown at a time, managed by the animator's speech timer
- Messages rotate every 45–75 seconds (`speechTiming`) — not every render cycle
- State changes trigger an immediate message pick from the new state's pool
- Each state has a pool of messages per language (randomly selected)
- The animator exposes `currentMessage` and the renderer uses it when available, falling back to random pick for `--once` mode

**Example messages per state**:

| State       | Example Messages                                   |
| ----------- | -------------------------------------------------- |
| `relaxed`   | "여유 있어요~", "All good!", "Plenty of room"      |
| `normal`    | "순조로워요", "Cruising along", "Steady pace"      |
| `concerned` | "슬슬 조심...", "Getting warm...", "Pace yourself" |
| `critical`  | "거의 다 찼어요!", "Running hot!", "Slow down!"    |
| `rateLimit` | "잠시 쉬어요...", "Taking a break...", "zzZ"       |
| `error`     | "연결 확인 중...", "Hmm...?", "Can't reach API"    |

#### Character Themes

Multiple character designs are available, selectable via configuration:

```yaml
# ~/.config/usage-monitor/config.yml
character:
  theme: "robot" # Character theme name
  animation: true # Enable/disable animations
  speechBubble: true # Enable/disable speech bubbles
  language: "auto" # Speech bubble language: "auto" | "en" | "ko"
```

**Built-in themes**:

| Theme     | Description              | Style                        |
| --------- | ------------------------ | ---------------------------- |
| `robot`   | Friendly robot (default) | Blocky, mechanical, LED eyes |
| `cat`     | Terminal cat             | Whiskers, ears, tail         |
| `penguin` | Linux-inspired penguin   | Round, tuxedo, waddle        |

**Theme data structure** (each theme must provide):

- Character art for each state (relaxed, normal, concerned, critical, rateLimit, error)
- Multiple frames per state (minimum 2, recommended 4–8 for varied idle animation)
- Optional per-state `timing` override (`AnimationTiming`)
- Optional `frameDurations` array for per-frame duration overrides (blink, wink, etc.)
- Preset-level `defaultTiming` and `speechTiming`
- Recommended width/height for layout calculations

#### Character Layout in Detail Pane

```
┌──────────────────────┐
│  ┌────────────────┐  │
│  │ All good! ◄──────── Speech Bubble
│  └──┬─────────────┘  │
│     │                │
│   ▗▟███▙▖            │
│  ▐█ ◉ ◉ █▌ ◄──────────── Character (state: relaxed)
│  ▐█▄▄▄▄▄█▌           │
│   ▀█████▀            │
│                      │
│ ─────────────────── ◄── Divider
│  user  ORG  PRO      │
│  5h ━━━━━━━━━ 44%    │
│  7d ━━━         12%  │
│  ↻ 3h 12m            │
└──────────────────────┘
```

## 7. Architecture

### 7.1 System Overview

```
┌──────────────────────────────────────────────────────────┐
│                      tmux Session                        │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Main Pane                                         │  │
│  │  (OpenCode / Claude Code / any terminal command)   │  │
│  │                                                    │  │
│  ├────────────────────────────────────────────────────┤  │
│  │  Monitor Pane (1–3 lines, compact)                 │  │
│  │  5h:━━━━━━44% │ 7d:━━12% │ MAX         ↻ 3h12m     │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 7.2 Component Overview

```
┌──────────────────────────────────────────────────────────────┐
│                    agentic-usage-monitor                     │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐                                        │
│  │  Launcher Scripts │                                       │
│  │  (tmux session    │                                       │
│  │   management)     │                                       │
│  └────────┬─────────┘                                        │
│           │                                                  │
│           ▼                                                  │
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
└──────────────────────────────────────────────────────────────┘
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

| Requirement          | Specification                            |
| -------------------- | ---------------------------------------- |
| Terminal Multiplexer | **tmux (core dependency)**               |
| Runtime              | Bun (Node.js compatible)                 |
| OS                   | macOS, Linux (**Windows not supported**) |
| Authentication       | OpenCode/Claude Code OAuth credentials   |

> **Windows**: tmux is not natively available on Windows. Windows support (e.g., via WSL or alternative terminal multiplexers) is planned for future releases.

### 8.2 Dependencies

**Design Principle**: Minimize dependencies. Only add what's strictly necessary.

| Category   | Package           | Purpose                    |
| ---------- | ----------------- | -------------------------- |
| Validation | zod               | Config/response validation |
| Dev        | typescript, biome | Type checking, linting     |

### 8.3 Credential Sources

Priority order for OAuth credentials:

1. **Claude Code (macOS Keychain)**: `security find-generic-password -s "Claude Code-credentials"` — primary source on macOS
2. **Claude Code (file)**: `~/.claude/.credentials.json` — fallback / Linux
3. **OpenCode**: `~/.local/share/opencode/auth.json`
4. **Test**: `TEST_CREDENTIALS_PATH` environment variable

## 9. Distribution

### 9.1 Standalone Binary

The project supports standalone binary distribution via `bun build --compile`, eliminating the need for a Bun runtime installation.

**Build targets**:

| Platform    | Binary Name                  |
| ----------- | ---------------------------- |
| macOS ARM64 | `usage-monitor-darwin-arm64` |
| macOS x64   | `usage-monitor-darwin-x64`   |
| Linux x64   | `usage-monitor-linux-x64`    |
| Linux ARM64 | `usage-monitor-linux-arm64`  |

**Build commands**:

```bash
bun run build:binary        # Current platform
bun run build:binary:all    # All platforms
```

### 9.2 Installation

**One-line install** (downloads from GitHub Releases):

```bash
curl -fsSL https://raw.githubusercontent.com/duchangkim/agentic-usage-monitor/main/install.sh | sh
```

The installer:

- Detects OS and architecture automatically
- Downloads the appropriate binary to `~/.local/bin/`
- Verifies SHA256 checksums
- Installs tmux if missing (with user's package manager)
- Removes macOS Gatekeeper quarantine attribute

**Custom install directory**:

```bash
INSTALL_DIR=/usr/local/bin curl -fsSL ... | sh
```

### 9.3 Launch Subcommand

The `usage-monitor launch` subcommand is the built-in tmux launcher:

```bash
usage-monitor launch -- opencode           # Monitor on bottom (default)
usage-monitor launch -t -- opencode        # Monitor on top
usage-monitor launch -b -- opencode        # Monitor on bottom
usage-monitor launch -s myproject -- nvim  # Named session
```

This is built into the standalone binary, so no separate script installation is needed.

### 9.4 CI/CD

- **CI**: Runs on push to main and PRs — typecheck, lint, build, E2E tests, binary smoke test
- **Release**: Triggered by `v*` tags — builds binaries for all platforms, generates checksums, creates GitHub Release

## 10. Removed Features

The following features from the current implementation will be **removed**:

### Admin API Integration

**Reason**: Complexity reduction. Focus on personal rate limits.

**Removed Components**:

- `src/data/admin-api.ts`
- `--api-only` CLI flag
- Organization billing/cost display
- `ANTHROPIC_ADMIN_API_KEY` support

**Migration**: Users needing org billing can use Anthropic Console or other tools.

## 11. Implementation Phases

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

### Phase 3: Character System (v1.2)

- [ ] Character data model: states, frames, theme interface
- [ ] Built-in `robot` theme (default) with all states
- [ ] Character renderer integrated into detail pane
- [ ] Usage-based state transitions (relaxed → normal → concerned → critical)
- [ ] Idle animation (blink) and loading animation
- [ ] Speech bubble system with state-aware message pools
- [ ] Character config options (`character.theme`, `character.animation`, `character.speechBubble`)
- [ ] Default mode change: right pane with character as default

### Phase 4: Character Themes & Polish (v1.3)

- [ ] `cat` theme
- [ ] `penguin` theme
- [ ] Speech bubble language support (`auto`, `en`, `ko`)
- [ ] Theme customization documentation
- [ ] Notification support (threshold alerts)

### Phase 5: Extensibility (v2.0)

- [ ] Formalize Provider interface
- [ ] Documentation for adding providers
- [ ] Custom character theme format (user-defined themes)
- [ ] Consider OpenAI/Gemini if demand exists

### Phase 6: User Experience (v2.1)

- [ ] Pane size persistence (remember resized pane across sessions)
- [ ] Mouse resize support with auto-save
- [ ] Usage trend display (optional)

### Phase 7: Platform Expansion (Future)

- [ ] Windows support via WSL
- [ ] Windows-native credential storage (Windows Credential Manager)
- [ ] Cross-platform credential loading (Linux keyring support)

## 12. Open Questions

| Question                        | Status  | Notes                                       |
| ------------------------------- | ------- | ------------------------------------------- |
| Character art dimensions        | TBD     | Fixed size or adapt to pane width?          |
| Custom theme format             | Planned | JSON/YAML for user-defined character themes |
| Speech bubble message limit     | TBD     | How many messages per state?                |
| Animation performance           | TBD     | Impact on CPU with frequent redraws?        |
| Status bar format customization | TBD     | How much flexibility?                       |
| Multiple provider display       | TBD     | Show all or active only?                    |
| Notification mechanism          | TBD     | Terminal bell? Desktop notification?        |

## 13. References

- [AGENTS.md](./AGENTS.md) - AI agent instructions
- [Claude-Usage-Tracker](https://github.com/hamed-elfayome/Claude-Usage-Tracker) - Reference macOS app
- [OpenCode](https://github.com/opencode-ai/opencode) - Primary integration target

---

**Document Version**: 1.2
**Last Updated**: 2026-02-23
**Authors**: Project maintainers
