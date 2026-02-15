#!/usr/bin/env bun
declare const __PKG_VERSION__: string
// In compiled binaries, __PKG_VERSION__ is injected via --define at build time.
// In dev mode (bun run), fall back to npm_package_version set by the package manager.
const VERSION =
	typeof __PKG_VERSION__ !== "undefined"
		? __PKG_VERSION__
		: (process.env.npm_package_version ?? "dev")

import { execSync } from "node:child_process"
import { VALID_THEMES, loadConfig } from "../config"
import { getAgent, getAgentNames, loadAgentConfig, resolveAgentConfig } from "../config/agents"
import { type CredentialSource, VALID_CREDENTIAL_SOURCES } from "../data/oauth-credentials"
import { type OAuthMonitorState, createOAuthMonitor } from "../monitor/oauth-monitor"
import { text } from "../tui/renderer"
import { getPresetNames, getTheme, initTheme } from "../tui/theme"
import {
	type ProfileData,
	type UsageData,
	renderCompact3Lines,
	renderStatusBar,
	renderUsageWidget,
} from "../tui/widget"
import { type PaneMoveDirection, moveMonitorPane } from "./pane-manager"

const MIN_WIDTH = 28
const MAX_WIDTH = 60

function getTerminalWidth(): number {
	const cols = process.stdout.columns || 40
	return Math.max(MIN_WIDTH, Math.min(cols - 1, MAX_WIDTH))
}

interface CliArgs {
	once: boolean
	compact: boolean
	config?: string
	source?: CredentialSource
	theme?: string
	help: boolean
	version: boolean
}

function parseArgs(args: string[]): CliArgs {
	const result: CliArgs = {
		once: false,
		compact: false,
		help: false,
		version: false,
	}

	for (let i = 0; i < args.length; i++) {
		const arg = args[i]
		switch (arg) {
			case "--once":
			case "-1":
				result.once = true
				break
			case "--compact":
				result.compact = true
				break
			case "--config":
			case "-c": {
				const nextArg = args[++i]
				if (nextArg) result.config = nextArg
				break
			}
			case "--source":
			case "-s": {
				const nextArg = args[++i]
				if (nextArg) result.source = nextArg as CredentialSource
				break
			}
			case "--theme": {
				const nextArg = args[++i]
				if (nextArg) result.theme = nextArg
				break
			}
			case "--help":
			case "-h":
				result.help = true
				break
			case "--version":
			case "-v":
				result.version = true
				break
		}
	}

	// Environment variable fallback for source
	if (!result.source && process.env.USAGE_MONITOR_SOURCE) {
		result.source = process.env.USAGE_MONITOR_SOURCE as CredentialSource
	}

	return result
}

function printHelp(): void {
	const { colors } = getTheme()
	console.log(`
${text("usage-monitor", colors.box.title)} - Monitor Claude rate limits

${text("USAGE:", colors.fg.heading)}
  usage-monitor [OPTIONS]
  usage-monitor <agent>               Run agent with usage monitor in tmux
  usage-monitor launch [OPTIONS] -- COMMAND

${text("AGENTS:", colors.fg.heading)}
  claude              Launch Claude Code with claude-code credentials
  opencode            Launch OpenCode with opencode credentials
  (Custom agents can be defined in ~/.config/usage-monitor/agents.json)

${text("SUBCOMMANDS:", colors.fg.heading)}
  launch              Run a command with usage monitor in a tmux pane
                      Use 'usage-monitor launch --help' for details
  update              Self-update to the latest version (binary install only)
  uninstall           Remove usage-monitor from your system (binary install only)

${text("OPTIONS:", colors.fg.heading)}
  -1, --once        Show usage once and exit (no auto-refresh)
  --compact         Minimal display mode (for small panes)
  --theme NAME      Color theme: ${getPresetNames().join(", ")}
  -s, --source      Credential source: auto, claude-code, opencode
                    (default: auto — tries all sources)
  -c, --config      Path to config file
  -h, --help        Show this help message
  -v, --version     Show version

${text("AUTHENTICATION:", colors.fg.heading)}
  Credentials are loaded automatically from (in priority order):
    1. Claude Code (macOS Keychain / ~/.claude/.credentials.json)
    2. OpenCode (~/.local/share/opencode/auth.json)
  Use --source to select a specific credential source.

${text("CONFIGURATION:", colors.fg.heading)}
  Config file: ~/.config/usage-monitor/config.json

${text("ENVIRONMENT VARIABLES:", colors.fg.heading)}
  USAGE_MONITOR_REFRESH_INTERVAL   Refresh interval in seconds

${text("EXAMPLES:", colors.fg.heading)}
  usage-monitor                    Show rate limits (auto-refresh)
  usage-monitor --once             One-shot display
  usage-monitor --theme nord       Use Nord color theme
  usage-monitor --compact          Minimal mode for small panes
  usage-monitor launch -- opencode Run with monitor in tmux
`)
}

function stateToProfile(state: OAuthMonitorState): ProfileData | null {
	if (!state.profile) return null

	const { account, organization } = state.profile
	let planBadge: "ENT" | "MAX" | "PRO" | undefined

	if (organization?.organizationType === "claude_enterprise") {
		planBadge = "ENT"
	} else if (account.hasClaudeMax) {
		planBadge = "MAX"
	} else if (account.hasClaudePro) {
		planBadge = "PRO"
	}

	return {
		displayName: account.displayName || account.fullName,
		organization: organization?.name,
		planBadge,
	}
}

function stateToUsage(state: OAuthMonitorState): UsageData | null {
	if (!state.rateLimits) return null

	return {
		fiveHour: state.rateLimits.fiveHour
			? {
					utilization: state.rateLimits.fiveHour.utilization,
					resetsAt: state.rateLimits.fiveHour.resetsAt,
				}
			: undefined,
		sevenDay: state.rateLimits.sevenDay
			? {
					utilization: state.rateLimits.sevenDay.utilization,
					resetsAt: state.rateLimits.sevenDay.resetsAt,
				}
			: undefined,
		sevenDayOpus: state.rateLimits.sevenDayOpus
			? {
					utilization: state.rateLimits.sevenDayOpus.utilization,
					resetsAt: state.rateLimits.sevenDayOpus.resetsAt,
				}
			: undefined,
	}
}

function renderRateLimitsWidget(
	state: OAuthMonitorState,
	width: number,
	forceCompact: boolean,
): string[] {
	const compact = forceCompact || width < 40
	const title = compact ? "Rate Limits" : "Claude Rate Limits"

	return renderUsageWidget(
		{ title, width, boxStyle: "rounded", compact },
		stateToProfile(state),
		stateToUsage(state),
		state.lastFetch,
		state.lastError,
	)
}

function clearScreen(): void {
	process.stdout.write("\x1B[2J\x1B[H")
}

function hideCursor(): void {
	process.stdout.write("\x1B[?25l")
}

function showCursor(): void {
	process.stdout.write("\x1B[?25h")
}

function loadAgents() {
	const fileResult = loadAgentConfig()
	const customConfig = fileResult.success ? fileResult.config : undefined
	return resolveAgentConfig(customConfig)
}

async function main(): Promise<void> {
	if (process.argv[2] === "launch") {
		const { runLaunch } = await import("./launch")
		runLaunch(process.argv.slice(3))
		process.exit(0)
	}

	if (process.argv[2] === "update") {
		const { runUpdate } = await import("./update")
		await runUpdate()
		process.exit(0)
	}

	if (process.argv[2] === "uninstall") {
		const { runUninstall } = await import("./uninstall")
		await runUninstall()
		process.exit(0)
	}

	// Check if first argument is an agent name
	const firstArg = process.argv[2]
	if (firstArg && !firstArg.startsWith("-")) {
		const agents = loadAgents()
		const agent = getAgent(agents, firstArg)

		if (agent) {
			// Agent subcommand: delegate to launch with agent's command and credential source
			const { runLaunch } = await import("./launch")
			const agentArgs = process.argv.slice(3) // remaining args after agent name
			const launchArgs = [
				"--source",
				agent.credential.source,
				...agentArgs,
				"--",
				...agent.command.split(" "),
			]
			runLaunch(launchArgs)
			process.exit(0)
		}

		// If it's not a known subcommand/flag, show error with available agents
		if (firstArg !== "launch") {
			const agentNames = getAgentNames(agents)
			const { colors } = getTheme()
			console.error(text(`Unknown agent: "${firstArg}"`, colors.status.danger))
			console.error("")
			console.error(`Available agents: ${agentNames.join(", ")}`)
			console.error("")
			console.error("Run 'usage-monitor --help' for more information.")
			process.exit(1)
		}
	}

	const args = parseArgs(process.argv.slice(2))

	if (args.help) {
		printHelp()
		process.exit(0)
	}

	if (args.version) {
		console.log(`usage-monitor v${VERSION}`)
		process.exit(0)
	}

	// Validate --source flag
	if (args.source && !VALID_CREDENTIAL_SOURCES.includes(args.source)) {
		const { colors } = getTheme()
		console.error(
			text(
				`Invalid source: "${args.source}". Valid sources: ${VALID_CREDENTIAL_SOURCES.join(", ")}`,
				colors.status.danger,
			),
		)
		process.exit(1)
	}

	// Validate --theme flag
	if (args.theme && !VALID_THEMES.includes(args.theme as (typeof VALID_THEMES)[number])) {
		const { colors } = getTheme()
		console.error(
			text(
				`Invalid theme: "${args.theme}". Available themes: ${getPresetNames().join(", ")}`,
				colors.status.danger,
			),
		)
		process.exit(1)
	}

	const configResult = loadConfig(args.config)

	if (configResult.warnings.length > 0) {
		const { colors } = getTheme()
		for (const warning of configResult.warnings) {
			console.error(text(`Warning: ${warning}`, colors.status.warning))
		}
	}

	const config = configResult.config

	// Initialize theme: CLI flag overrides config
	const themeName = args.theme ?? config.theme
	initTheme(process.env, themeName)

	if (!config.oauth.enabled) {
		const { colors } = getTheme()
		console.log(text("OAuth is disabled in configuration.", colors.status.warning))
		process.exit(0)
	}

	const monitor = createOAuthMonitor(config, args.source)

	let compactMode = args.compact || config.widget.compact

	if (args.once) {
		const width = getTerminalWidth()
		await monitor.fetch()
		const state = monitor.getState()

		if (compactMode) {
			const lines = renderCompact3Lines(stateToProfile(state), stateToUsage(state), state.lastError)
			for (const line of lines) {
				console.log(line)
			}
		} else {
			const output = renderRateLimitsWidget(state, width, false).join("\n")
			console.log(output)
			if (state.lastError) {
				const { colors } = getTheme()
				console.log("")
				console.log(text("Please authenticate via Claude Code or OpenCode.", colors.status.warning))
			}
		}
		process.exit(0)
	}

	hideCursor()
	clearScreen()

	const render = (): void => {
		const width = getTerminalWidth()
		const state = monitor.getState()

		if (compactMode) {
			const lines = renderCompact3Lines(stateToProfile(state), stateToUsage(state), state.lastError)
			process.stdout.write(`\x1B[H${lines[0]}\x1B[K\n${lines[1]}\x1B[K\n${lines[2]}\x1B[K`)
		} else {
			const { colors } = getTheme()
			clearScreen()
			console.log(renderRateLimitsWidget(state, width, false).join("\n"))
			console.log("")
			console.log(
				renderStatusBar(state.isRunning, state.lastError, config.display.refreshInterval, width),
			)
			console.log("")
			console.log(text("Press q to exit", colors.fg.subtle))
		}
	}

	monitor.on((event) => {
		if (event.type === "update" || event.type === "error") {
			render()
		}
	})

	const tmuxSession = process.env.USAGE_MONITOR_SESSION

	const cleanup = (): void => {
		monitor.stop()
		if (process.stdin.isTTY) {
			process.stdin.setRawMode(false)
		}
		showCursor()
		clearScreen()
		console.log("Goodbye!")
		process.exit(0)
	}

	const killTmuxSession = (): void => {
		if (tmuxSession) {
			try {
				execSync(`tmux kill-session -t ${JSON.stringify(tmuxSession)}`, { stdio: "ignore" })
			} catch {
				// Session may not exist, ignore
			}
			process.exit(0)
		} else {
			cleanup()
		}
	}

	// Move monitor pane to a new position within the tmux session
	const monitorPaneId = process.env.TMUX_PANE

	const movePane = (direction: PaneMoveDirection): void => {
		if (!tmuxSession || !monitorPaneId) return
		const result = moveMonitorPane(tmuxSession, monitorPaneId, direction, compactMode)
		if (result.success) {
			compactMode = result.newCompactMode
			render()
		}
	}

	// Keyboard input handling
	if (process.stdin.isTTY) {
		process.stdin.setRawMode(true)
		process.stdin.resume()
		process.stdin.on("data", (data: Buffer) => {
			const key = data.toString()

			// q/Q — exit
			if (key === "q" || key === "Q") {
				killTmuxSession()
				return
			}

			// Ctrl+C
			if (key === "\x03") {
				killTmuxSession()
				return
			}

			// Tab — toggle compact/detailed mode (only in left/right position)
			if (key === "\t") {
				// Only toggle if we're not in a forced compact position (top/bottom)
				// In tmux, we can't reliably detect position, so just toggle the mode
				// Note: compact mode is forced when position is top/bottom via Shift+Arrow
				if (!compactMode) {
					compactMode = true
				} else {
					compactMode = false
				}
				clearScreen()
				render()
				return
			}

			// Shift+Arrow keys (ANSI escape sequences with extended-keys)
			// \x1b[1;2A = Shift+Up, \x1b[1;2B = Shift+Down
			// \x1b[1;2C = Shift+Right, \x1b[1;2D = Shift+Left
			if (key === "\x1b[1;2A") {
				movePane("up")
				return
			}
			if (key === "\x1b[1;2B") {
				movePane("down")
				return
			}
			if (key === "\x1b[1;2C") {
				movePane("right")
				return
			}
			if (key === "\x1b[1;2D") {
				movePane("left")
				return
			}
		})
	}

	process.on("SIGINT", killTmuxSession)
	process.on("SIGTERM", killTmuxSession)
	process.stdout.on("resize", render)

	monitor.start()
	render()
}

main().catch((error) => {
	const { colors } = getTheme()
	console.error(text(`Error: ${error}`, colors.status.danger))
	process.exit(1)
})
