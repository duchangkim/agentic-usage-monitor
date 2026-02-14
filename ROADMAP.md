# Roadmap

## v0.0.7 - Multi-source Credentials & Agent Subcommands

- [x] `--source` flag for explicit credential source selection (`claude-code`, `opencode`, `auto`)
- [x] `USAGE_MONITOR_SOURCE` environment variable support
- [x] Agent config file (`~/.config/usage-monitor/agents.json`)
- [x] Agent subcommands (`usage-monitor claude`, `usage-monitor opencode`)
- [x] Opus 7-day usage display in TUI (conditional, only when data available)

## v0.0.8 - Command Cleanup & UX

- [x] Remove deprecated `with-monitor` shell script completely
- [x] Remove redundant CLI flags and options
- [x] `usage-monitor update` - Self-update command
- [x] `usage-monitor uninstall` - Self-removal command
- [x] Final CLI interface simplification
- [x] Default pane position: `bottom` (compact mode)
- [x] Interactive keyboard shortcuts in monitor pane
  - `Shift+Arrow`: Move pane position (top/bottom/left/right)
  - `Tab`: Toggle compact/detailed mode (ignored in top/bottom)
  - `q`: Exit (moved from bash wrapper to Bun process)
- [x] Migrate keyboard handling from bash wrapper to Bun process

## TUI Enhancement & Auto-update

- [ ] TUI graph refinement (improved bar/progress visuals)
- [ ] Configurable color themes
- [ ] Auto-update check on startup with interactive y/n prompt

## Future

- [ ] Multi-vendor support (GitHub Copilot, Antigravity, Codex, etc.)
- [ ] Windows OS support