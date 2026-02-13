# Roadmap

## v0.0.7 - Multi-source Credentials & Agent Subcommands

- [x] `--source` flag for explicit credential source selection (`claude-code`, `opencode`, `auto`)
- [x] `USAGE_MONITOR_SOURCE` environment variable support
- [x] Agent config file (`~/.config/usage-monitor/agents.json`)
- [x] Agent subcommands (`usage-monitor claude`, `usage-monitor opencode`)
- [x] Opus 7-day usage display in TUI (conditional, only when data available)

## v0.0.8 - Command Cleanup & UX

- [ ] Remove deprecated `with-monitor` shell script completely
- [ ] Remove redundant CLI flags and options
- [ ] `usage-monitor update` - Self-update command
- [ ] `usage-monitor uninstall` - Self-removal command
- [ ] Final CLI interface simplification
