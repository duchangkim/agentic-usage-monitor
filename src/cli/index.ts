#!/usr/bin/env bun
import { loadConfig } from "../config"
import { createMonitor } from "../monitor"
import { type OAuthMonitorState, createOAuthMonitor } from "../monitor/oauth-monitor"
import { text } from "../tui/renderer"
import { ANSI } from "../tui/styles"
import {
	type ProfileData,
	type UsageData,
	renderApiUsageWidget,
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
	apiOnly: boolean
	oauthOnly: boolean
	config?: string
	help: boolean
	version: boolean
}

function parseArgs(args: string[]): CliArgs {
	const result: CliArgs = {
		once: false,
		apiOnly: false,
		oauthOnly: false,
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
			case "--api-only":
				result.apiOnly = true
				break
			case "--oauth-only":
			case "--rate-limits":
				result.oauthOnly = true
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
${text("usage-monitor", ANSI.bold)} - Monitor Claude usage and rate limits

${text("USAGE:", ANSI.fg.yellow)}
  usage-monitor [OPTIONS]

${text("OPTIONS:", ANSI.fg.yellow)}
  -1, --once        Show usage once and exit (no auto-refresh)
  --api-only        Only show Admin API usage (organizations only)
  --oauth-only      Only show OAuth rate limits (personal accounts)
  --rate-limits     Alias for --oauth-only
  -c, --config      Path to config file
  -h, --help        Show this help message
  -v, --version     Show version

${text("DATA SOURCES:", ANSI.fg.yellow)}
  OAuth (default)   Uses OpenCode (~/.local/share/opencode/auth.json)
                    or Claude Code (~/.claude/.credentials.json) credentials
                    Shows personal rate limits (5-hour, 7-day windows)
  Admin API         Requires ANTHROPIC_ADMIN_API_KEY (organizations only)
                    Shows cost and token usage

${text("CONFIGURATION:", ANSI.fg.yellow)}
  Config file locations (in order of priority):
    1. ~/.config/usage-monitor/config.yaml
    2. ~/.usage-monitor.yaml
    3. ./.usage-monitor.yaml

${text("ENVIRONMENT VARIABLES:", ANSI.fg.yellow)}
  ANTHROPIC_ADMIN_API_KEY          Admin API key (organizations)
  USAGE_MONITOR_REFRESH_INTERVAL   Refresh interval in seconds

${text("EXAMPLES:", ANSI.fg.yellow)}
  usage-monitor                    Show rate limits (OAuth)
  usage-monitor --once             One-shot display
  usage-monitor --api-only         Organization usage only
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

function renderRateLimitsWidget(state: OAuthMonitorState, width: number): string[] {
	const compact = width < 40
	const title = compact ? "Rate Limits" : "Claude Rate Limits"

	return renderUsageWidget(
		{ title, width, boxStyle: "rounded", compact },
		stateToProfile(state),
		stateToUsage(state),
		state.lastFetch,
		state.lastError,
	)
}

function renderApiWidget(
	usage: {
		totalInputTokens: number
		totalOutputTokens: number
		totalCost: number
		periodStart: Date
		periodEnd: Date
		lastUpdated: Date
	} | null,
	width: number,
): string[] {
	return renderApiUsageWidget(
		{ title: "API Usage (This Month)", width, boxStyle: "rounded" },
		usage
			? {
					totalInputTokens: usage.totalInputTokens,
					totalOutputTokens: usage.totalOutputTokens,
					totalCost: usage.totalCost,
					lastUpdated: usage.lastUpdated,
				}
			: null,
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

	const showOAuth = !args.apiOnly && config.oauth.enabled
	const showApi = !args.oauthOnly && config.anthropic.enabled && config.anthropic.adminApiKey

	const oauthMonitor = showOAuth ? createOAuthMonitor(config) : null
	const apiMonitor = showApi ? createMonitor(config) : null

	if (args.once) {
		const outputs: string[] = []
		const width = getTerminalWidth()

		if (oauthMonitor) {
			await oauthMonitor.fetch()
			outputs.push(renderRateLimitsWidget(oauthMonitor.getState(), width).join("\n"))
		}

		if (apiMonitor) {
			const usage = await apiMonitor.fetch()
			outputs.push(renderApiWidget(usage, width).join("\n"))
		}

		if (outputs.length === 0) {
			console.log(text("No data sources configured.", ANSI.fg.yellow))
			console.log("Run 'opencode auth login' or install Claude Code to authenticate.")
		} else {
			console.log(outputs.join("\n\n"))
		}
		process.exit(0)
	}

	hideCursor()
	clearScreen()

	const render = (): void => {
		clearScreen()
		const outputs: string[] = []
		const width = getTerminalWidth()

		if (oauthMonitor) {
			outputs.push(renderRateLimitsWidget(oauthMonitor.getState(), width).join("\n"))
		}

		if (apiMonitor) {
			const state = apiMonitor.getState()
			outputs.push(renderApiWidget(state.usage, width).join("\n"))
		}

		if (outputs.length === 0) {
			console.log(text("No data sources configured.", ANSI.fg.yellow))
		} else {
			console.log(outputs.join("\n\n"))
		}

		const isRunning =
			(oauthMonitor?.getState().isRunning ?? false) || (apiMonitor?.getState().isRunning ?? false)
		const lastError = oauthMonitor?.getState().lastError || apiMonitor?.getState().lastError || null

		console.log("")
		console.log(renderStatusBar(isRunning, lastError, config.display.refreshInterval, width))
		console.log("")
		console.log(text("Press Ctrl+C to exit", ANSI.dim))
	}

	if (oauthMonitor) {
		oauthMonitor.on((event) => {
			if (event.type === "update" || event.type === "error") {
				render()
			}
		})
	}

	if (apiMonitor) {
		apiMonitor.on((event) => {
			if (event.type === "update" || event.type === "error") {
				render()
			}
		})
	}

	const cleanup = (): void => {
		oauthMonitor?.stop()
		apiMonitor?.stop()
		showCursor()
		clearScreen()
		console.log("Goodbye!")
		process.exit(0)
	}

	process.on("SIGINT", cleanup)
	process.on("SIGTERM", cleanup)
	process.stdout.on("resize", render)

	oauthMonitor?.start()
	apiMonitor?.start()
	render()
}

main().catch((error) => {
	console.error(text(`Error: ${error}`, ANSI.fg.red))
	process.exit(1)
})
