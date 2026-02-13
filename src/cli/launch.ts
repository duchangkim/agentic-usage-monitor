import { execSync, spawnSync } from "node:child_process"
import { writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const HORIZONTAL_PANE_SIZE = 20
const VERTICAL_PANE_LINES = 3

type Position = "left" | "right" | "top" | "bottom"

interface LaunchArgs {
	position: Position
	sessionName: string
	help: boolean
	command: string[]
}

function getMonitorCmd(): string {
	const scriptPath = process.argv[1]
	// Compiled binary: argv[1] points to Bun's internal virtual filesystem (/$bunfs/root/...)
	// Dev mode (bun run): argv[1] is the actual source file path (e.g., src/cli/index.ts)
	if (!scriptPath || scriptPath.startsWith("/$bunfs/") || scriptPath === process.execPath) {
		return process.execPath
	}
	return `bun run ${scriptPath}`
}

function printUsage(): void {
	const name = "usage-monitor launch"
	console.log(`Usage: ${name} [OPTIONS] -- COMMAND [args...]

Run any command with usage monitor in a tmux pane.

OPTIONS:
    -l, --left            put monitor on left (default: right)
    -r, --right           put monitor on right
    -t, --top             put monitor on top
    -b, --bottom          put monitor on bottom
    -s, --session NAME    tmux session name (default: monitor-PID)
    -h, --help            show this help

EXAMPLES:
    ${name} -- opencode
    ${name} -- nvim .
    ${name} -t -- opencode           # monitor on top
    ${name} -b -- opencode           # monitor on bottom
    ${name} -l -- zsh                # monitor on left
    ${name} -s myproject -- opencode

ENVIRONMENT:
    USAGE_MONITOR_SESSION   default session name

REQUIREMENTS:
    - tmux (brew install tmux)`)
}

function parseLaunchArgs(args: string[]): LaunchArgs {
	const result: LaunchArgs = {
		position: "right",
		sessionName: process.env.USAGE_MONITOR_SESSION ?? `monitor-${process.pid}`,
		help: false,
		command: [],
	}

	let i = 0
	while (i < args.length) {
		const arg = args[i]
		switch (arg) {
			case "-l":
			case "--left":
				result.position = "left"
				i++
				break
			case "-r":
			case "--right":
				result.position = "right"
				i++
				break
			case "-t":
			case "--top":
				result.position = "top"
				i++
				break
			case "-b":
			case "--bottom":
				result.position = "bottom"
				i++
				break
			case "-s":
			case "--session":
				i++
				if (i < args.length) {
					result.sessionName = args[i] as string
				}
				i++
				break
			case "-h":
			case "--help":
				result.help = true
				i++
				break
			case "--":
				result.command = args.slice(i + 1)
				return result
			default:
				result.command = args.slice(i)
				return result
		}
	}

	return result
}

function commandExists(cmd: string): boolean {
	try {
		execSync(`command -v ${cmd}`, { stdio: "ignore" })
		return true
	} catch {
		return false
	}
}

function tmuxSessionExists(sessionName: string): boolean {
	try {
		execSync(`tmux has-session -t ${JSON.stringify(sessionName)}`, { stdio: "ignore" })
		return true
	} catch {
		return false
	}
}

function tmux(args: string): void {
	execSync(`tmux ${args}`, { stdio: "ignore" })
}

function getTerminalSize(): { cols: number; rows: number } {
	let cols = 80
	let rows = 24
	try {
		cols = Number.parseInt(execSync("tput cols", { encoding: "utf-8" }).trim(), 10) || 80
		rows = Number.parseInt(execSync("tput lines", { encoding: "utf-8" }).trim(), 10) || 24
	} catch {
		// Use defaults
	}
	return { cols, rows }
}

function createMonitorWrapper(monitorCmd: string, sessionName: string, position: Position): string {
	const fullMonitorCmd =
		position === "top" || position === "bottom" ? `${monitorCmd} --compact` : monitorCmd

	const wrapperPath = join(tmpdir(), `usage-monitor-${process.pid}-${Date.now()}`)
	const script = `#!/usr/bin/env bash
rm -f "${wrapperPath}"
stty raw -echo 2>/dev/null
${fullMonitorCmd} </dev/null &
MPID=$!
trap 'kill $MPID 2>/dev/null' EXIT
while IFS= read -r -n1 key 2>/dev/null; do
    case "$key" in
        q|Q) tmux kill-session -t "${sessionName}" 2>/dev/null; exit 0;;
    esac
done
wait $MPID 2>/dev/null
`
	writeFileSync(wrapperPath, script, { mode: 0o755 })
	return wrapperPath
}

export function runLaunch(args: string[]): void {
	const parsed = parseLaunchArgs(args)

	if (parsed.help) {
		printUsage()
		return
	}

	if (parsed.command.length === 0) {
		console.error("Error: No command specified.")
		console.error("")
		printUsage()
		process.exit(1)
	}

	if (!commandExists("tmux")) {
		console.error("Error: tmux is required but not installed.")
		console.error("")
		console.error("Install with:")
		console.error("  macOS:  brew install tmux")
		console.error("  Ubuntu: sudo apt install tmux")
		console.error("  Fedora: sudo dnf install tmux")
		process.exit(1)
	}

	const sessionName = parsed.sessionName
	const mainCmd = parsed.command.join(" ")

	if (tmuxSessionExists(sessionName)) {
		console.error(`Session '${sessionName}' already exists. Attaching...`)
		spawnSync("tmux", ["attach-session", "-t", sessionName], { stdio: "inherit" })
		return
	}

	console.log(`Starting tmux session: ${sessionName}`)
	console.log(`  Command: ${mainCmd}`)
	console.log(`  Monitor: ${parsed.position}`)
	console.log("")

	const mainPaneName = "main"
	const monitorPaneName = "monitor"

	// Wrapper to kill session when main command exits
	const wrappedCmd = `${mainCmd}; tmux kill-session -t '${sessionName}' 2>/dev/null || true`

	const { cols, rows } = getTerminalSize()

	// Create main pane first
	tmux(
		`new-session -d -s ${JSON.stringify(sessionName)} -x ${cols} -y ${rows} "sh -c '${wrappedCmd.replace(/'/g, "'\\''")}'"`,
	)
	tmux(`select-pane -t ${JSON.stringify(sessionName)}:0.0 -T ${JSON.stringify(mainPaneName)}`)
	tmux(`set-option -t ${JSON.stringify(sessionName)} mouse on`)

	// Extended keys support - enables tmux to recognize modifier key combinations (e.g. S-Enter)
	// Requires tmux 3.2+; silently ignored on older versions via the tmux() helper
	tmux(`set-option -t ${JSON.stringify(sessionName)} extended-keys on`)

	// Bind Shift+Enter to send ESC+CR — Claude Code expects this sequence for newline input
	// tmux recognizes S-Enter via extended-keys; the binding intercepts it before forwarding
	tmux("bind-key -n S-Enter send-keys Escape Enter")

	// Allow terminal passthrough sequences (DCS, OSC) to reach the outer terminal
	// Requires tmux 3.3+; needed for some TUI features in claude code / opencode
	tmux(`set-option -t ${JSON.stringify(sessionName)} allow-passthrough on`)

	// Status bar with exit hint
	tmux(`set-option -t ${JSON.stringify(sessionName)} status on`)
	tmux(`set-option -t ${JSON.stringify(sessionName)} status-style "bg=default,fg=colour245"`)
	tmux(
		`set-option -t ${JSON.stringify(sessionName)} status-left "#[fg=colour75,bold] ${sessionName} #[default]"`,
	)
	tmux(`set-option -t ${JSON.stringify(sessionName)} status-left-length 30`)
	tmux(
		`set-option -t ${JSON.stringify(sessionName)} status-right "#[fg=colour245]Monitor: press q to exit #[default]"`,
	)
	tmux(`set-option -t ${JSON.stringify(sessionName)} status-right-length 40`)

	// Create monitor wrapper script
	const monitorCmd = getMonitorCmd()
	const wrapperPath = createMonitorWrapper(monitorCmd, sessionName, parsed.position)
	const wrapperCmd = `bash '${wrapperPath}'`

	const s = JSON.stringify(sessionName)

	// Split based on position
	switch (parsed.position) {
		case "left":
			tmux(`split-window -h -b -t ${s} -l ${HORIZONTAL_PANE_SIZE}% "${wrapperCmd}"`)
			tmux(`select-pane -t ${s}:0.0 -T ${JSON.stringify(monitorPaneName)}`)
			tmux(`select-pane -t ${s}:0.1`)
			break
		case "right":
			tmux(`split-window -h -t ${s} -l ${HORIZONTAL_PANE_SIZE}% "${wrapperCmd}"`)
			tmux(`select-pane -t ${s}:0.1 -T ${JSON.stringify(monitorPaneName)}`)
			tmux(`select-pane -t ${s}:0.0`)
			break
		case "top":
			tmux(`split-window -v -b -t ${s} -l ${VERTICAL_PANE_LINES} "${wrapperCmd}"`)
			tmux(`select-pane -t ${s}:0.0 -T ${JSON.stringify(monitorPaneName)}`)
			tmux(`select-pane -t ${s}:0.1`)
			tmux(
				`set-hook -t ${s} window-layout-changed "resize-pane -t '${sessionName}:0.0' -y ${VERTICAL_PANE_LINES}"`,
			)
			break
		case "bottom":
			tmux(`split-window -v -t ${s} -l ${VERTICAL_PANE_LINES} "${wrapperCmd}"`)
			tmux(`select-pane -t ${s}:0.1 -T ${JSON.stringify(monitorPaneName)}`)
			tmux(`select-pane -t ${s}:0.0`)
			tmux(
				`set-hook -t ${s} window-layout-changed "resize-pane -t '${sessionName}:0.1' -y ${VERTICAL_PANE_LINES}"`,
			)
			break
	}

	// Prevent mouse scroll in monitor pane (cancel copy mode immediately)
	tmux(
		`set-hook -t ${s} pane-mode-changed "if -F '#{==:#{pane_title},monitor}' 'send-keys -X cancel'"`,
	)

	// Attach to the session (replaces current process)
	spawnSync("tmux", ["attach-session", "-t", sessionName], { stdio: "inherit" })
}
