import type { Hooks, Plugin, PluginInput } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"
import { loadConfig } from "./config"

const MONITOR_PANE_TITLE = "usage-monitor"
const HORIZONTAL_PANE_SIZE = 20
const VERTICAL_PANE_LINES = 1

function isInTmux(): boolean {
	return Boolean(process.env.TMUX)
}

function isTmuxInstalled(): boolean {
	const result = Bun.spawnSync(["which", "tmux"])
	return result.exitCode === 0
}

function getMonitorPaneId(): string | null {
	const result = Bun.spawnSync(["tmux", "list-panes", "-F", "#{pane_id}:#{pane_title}"])
	if (result.exitCode !== 0) return null

	const lines = result.stdout.toString().trim().split("\n")
	for (const line of lines) {
		if (line.includes(MONITOR_PANE_TITLE)) {
			const paneId = line.split(":")[0]
			if (paneId) return paneId
		}
	}
	return null
}

type Position = "left" | "right" | "top" | "bottom"

function createMonitorPane(position: Position): {
	success: boolean
	message: string
	position: Position
} {
	const splitArgs = buildTmuxSplitArgs(position)
	const isVertical = position === "top" || position === "bottom"
	const monitorCmd = isVertical ? "usage-monitor --compact" : "usage-monitor"
	const result = Bun.spawnSync(["tmux", "split-window", ...splitArgs, monitorCmd])

	if (result.exitCode !== 0) {
		return {
			success: false,
			message: `Failed to create pane: ${result.stderr.toString()}`,
			position,
		}
	}

	Bun.spawnSync(["tmux", "select-pane", "-T", MONITOR_PANE_TITLE, "-t", "{last}"])
	focusMainPane(position)

	return { success: true, message: "Monitor pane created", position }
}

function buildTmuxSplitArgs(position: Position): string[] {
	switch (position) {
		case "left":
			return ["-h", "-b", "-l", `${HORIZONTAL_PANE_SIZE}%`]
		case "right":
			return ["-h", "-l", `${HORIZONTAL_PANE_SIZE}%`]
		case "top":
			return ["-v", "-b", "-l", `${VERTICAL_PANE_LINES}`]
		case "bottom":
			return ["-v", "-l", `${VERTICAL_PANE_LINES}`]
	}
}

function focusMainPane(position: Position): void {
	const directionMap: Record<Position, string> = {
		left: "{right}",
		right: "{left}",
		top: "{down}",
		bottom: "{up}",
	}
	Bun.spawnSync(["tmux", "select-pane", "-t", directionMap[position]])
}

function closeMonitorPane(paneId: string): { success: boolean; message: string } {
	const result = Bun.spawnSync(["tmux", "kill-pane", "-t", paneId])

	if (result.exitCode !== 0) {
		return {
			success: false,
			message: `Failed to close pane: ${result.stderr.toString()}`,
		}
	}

	return { success: true, message: "Monitor pane closed" }
}

export const UsageMonitorPlugin: Plugin = async (_ctx: PluginInput) => {
	const { config } = loadConfig()
	const position = config.widget.position

	return {
		tool: {
			monitor: tool({
				description: "Toggle usage monitor pane in tmux, check status, or get setup instructions",
				args: {
					action: tool.schema
						.enum(["toggle", "status", "setup", "help"])
						.default("toggle")
						.describe(
							"Action: toggle (show/hide monitor pane), status (check state), setup (installation guide), help (usage)",
						),
				},
				async execute(args) {
					if (args.action === "help") {
						return `Usage Monitor - tmux Integration

Toggle a real-time rate limit monitor pane alongside OpenCode.

COMMANDS:
  /monitor toggle  - Show or hide the monitor pane
  /monitor status  - Check if tmux and monitor are running
  /monitor setup   - Show setup instructions
  /monitor help    - Show this help

REQUIREMENTS:
  - Must be running inside tmux session
  - usage-monitor CLI must be installed globally`
					}

					if (args.action === "setup") {
						return `Usage Monitor Setup Guide

STEP 1: Install tmux (if not installed)
  macOS:  brew install tmux
  Ubuntu: sudo apt install tmux

STEP 2: Install usage-monitor globally
  bun install -g opencode-usage-monitor

STEP 3: Enable /monitor command (optional)
  mkdir -p .opencode/commands
  cat > .opencode/commands/monitor.md << 'EOF'
---
description: Toggle usage rate limit monitor pane
---
Toggle the usage monitor pane to show/hide Claude rate limits.
EOF

STEP 4: Start opencode inside tmux
  tmux new-session -s dev
  opencode

STEP 5: Toggle the monitor
  /monitor  (with autocomplete if step 3 done)
  Or ask: "show the rate limit monitor"

POSITION:
  Configure in ~/.config/usage-monitor/config.yaml:
    widget:
      position: right  # left, right, top, or bottom`
					}

					if (!isTmuxInstalled()) {
						return `Error: tmux is not installed.

Install tmux first:
  macOS:  brew install tmux
  Ubuntu: sudo apt install tmux

Then run: /monitor setup`
					}

					if (!isInTmux()) {
						return `Error: Not running inside tmux session.

Start a tmux session first:
  tmux new-session -s dev
  opencode

Then use /monitor toggle to show the rate limit pane.`
					}

					if (args.action === "status") {
						const lines: string[] = ["Usage Monitor Status", ""]
						lines.push("✓ tmux is installed")
						lines.push("✓ Running inside tmux session")

						const sessionProc = Bun.spawnSync(["tmux", "display-message", "-p", "#S"])
						if (sessionProc.exitCode === 0) {
							lines.push(`  Session: ${sessionProc.stdout.toString().trim()}`)
						}

						const monitorPaneId = getMonitorPaneId()
						if (monitorPaneId) {
							lines.push("")
							lines.push("✓ Monitor pane is active")
							lines.push("  Use '/monitor toggle' to hide it")
						} else {
							lines.push("")
							lines.push("○ Monitor pane is not active")
							lines.push("  Use '/monitor toggle' to show it")
						}

						return lines.join("\n")
					}

					const existingPaneId = getMonitorPaneId()

					if (existingPaneId) {
						const result = closeMonitorPane(existingPaneId)
						if (result.success) {
							return "Monitor pane closed."
						}
						return `Error: ${result.message}`
					}

					const result = createMonitorPane(position)
					if (result.success) {
						return `Monitor pane opened. Real-time rate limits are now visible on the ${result.position}.`
					}
					return `Error: ${result.message}`
				},
			}),
		},
	} satisfies Partial<Hooks>
}

export default UsageMonitorPlugin
