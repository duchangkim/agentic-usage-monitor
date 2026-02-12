#!/usr/bin/env bun
import { loadConfig } from "../config"
import { type OAuthMonitorState, createOAuthMonitor } from "../monitor/oauth-monitor"
import { text } from "../tui/renderer"
import { ANSI } from "../tui/styles"
import {
	type ProfileData,
	type UsageData,
	renderCompact3Lines,
	renderStatusBar,
	renderUsageWidget,
} from "../tui/widget"

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

	return result
}

function printHelp(): void {
	console.log(`
${text("usage-monitor", ANSI.bold)} - Monitor Claude rate limits

${text("USAGE:", ANSI.fg.yellow)}
  usage-monitor [OPTIONS]

${text("OPTIONS:", ANSI.fg.yellow)}
  -1, --once        Show usage once and exit (no auto-refresh)
  --compact         Minimal display mode (for small panes)
  -c, --config      Path to config file
  -h, --help        Show this help message
  -v, --version     Show version

${text("AUTHENTICATION:", ANSI.fg.yellow)}
  Credentials are loaded automatically from:
    1. Claude Code: ~/.claude/.credentials.json
    2. OpenCode: ~/.local/share/opencode/auth.json

${text("CONFIGURATION:", ANSI.fg.yellow)}
  Config file locations (in order of priority):
    1. ~/.config/usage-monitor/config.yaml
    2. ~/.usage-monitor.yaml
    3. ./.usage-monitor.yaml

${text("ENVIRONMENT VARIABLES:", ANSI.fg.yellow)}
  USAGE_MONITOR_REFRESH_INTERVAL   Refresh interval in seconds

${text("EXAMPLES:", ANSI.fg.yellow)}
  usage-monitor                    Show rate limits (auto-refresh)
  usage-monitor --once             One-shot display
  usage-monitor --compact          Minimal mode for small panes
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

async function main(): Promise<void> {
	const args = parseArgs(process.argv.slice(2))

	if (args.help) {
		printHelp()
		process.exit(0)
	}

	if (args.version) {
		console.log("usage-monitor v0.1.0")
		process.exit(0)
	}

	const configResult = loadConfig(args.config)

	if (configResult.warnings.length > 0) {
		for (const warning of configResult.warnings) {
			console.error(text(`Warning: ${warning}`, ANSI.fg.yellow))
		}
	}

	const config = configResult.config

	if (!config.oauth.enabled) {
		console.log(text("OAuth is disabled in configuration.", ANSI.fg.yellow))
		process.exit(0)
	}

	const monitor = createOAuthMonitor(config)

	const compactMode = args.compact || config.widget.compact

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
				console.log("")
				console.log(text("Please authenticate via Claude Code or OpenCode.", ANSI.fg.yellow))
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
			clearScreen()
			console.log(renderRateLimitsWidget(state, width, false).join("\n"))
			console.log("")
			console.log(
				renderStatusBar(state.isRunning, state.lastError, config.display.refreshInterval, width),
			)
			console.log("")
			console.log(text("Press q to exit", ANSI.dim))
		}
	}

	monitor.on((event) => {
		if (event.type === "update" || event.type === "error") {
			render()
		}
	})

	const cleanup = (): void => {
		monitor.stop()
		showCursor()
		clearScreen()
		console.log("Goodbye!")
		process.exit(0)
	}

	process.on("SIGINT", cleanup)
	process.on("SIGTERM", cleanup)
	process.stdout.on("resize", render)

	monitor.start()
	render()
}

main().catch((error) => {
	console.error(text(`Error: ${error}`, ANSI.fg.red))
	process.exit(1)
})
