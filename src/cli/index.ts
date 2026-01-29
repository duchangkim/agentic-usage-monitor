#!/usr/bin/env bun
import { loadConfig } from "../config"
import { createMonitor } from "../monitor"
import { type OAuthMonitorState, createOAuthMonitor } from "../monitor/oauth-monitor"
import { progressBarWithThreshold } from "../tui/progress"
import { boxBottom, boxDivider, boxRow, boxTop, text } from "../tui/renderer"
import { ANSI } from "../tui/styles"

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

function formatTokens(tokens: number): string {
	if (tokens >= 1_000_000) {
		return `${(tokens / 1_000_000).toFixed(2)}M`
	}
	if (tokens >= 1_000) {
		return `${(tokens / 1_000).toFixed(1)}K`
	}
	return tokens.toString()
}

function formatCost(amount: number, currency: string): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency,
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(amount)
}

function formatTimeRemaining(resetTime: Date): string {
	const now = new Date()
	const diff = resetTime.getTime() - now.getTime()

	if (diff <= 0) return "now"

	const hours = Math.floor(diff / (1000 * 60 * 60))
	const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

	if (hours > 0) {
		return `${hours}h ${minutes}m`
	}
	return `${minutes}m`
}

function renderRateLimitsWidget(state: OAuthMonitorState, width: number): string[] {
	const lines: string[] = []
	const compact = width < 40
	const title = compact ? "Rate Limits" : "Claude Rate Limits"

	lines.push(boxTop(width, title, { boxStyle: "rounded" }))

	if (state.profile) {
		const { account, organization } = state.profile
		const displayName = account.displayName || account.fullName
		const truncatedName =
			displayName.length > width - 10 ? `${displayName.slice(0, width - 13)}...` : displayName
		lines.push(
			boxRow(`${text("User:", ANSI.dim)} ${truncatedName}`, width, { boxStyle: "rounded" }),
		)

		if (organization && !compact) {
			const orgName =
				organization.name.length > width - 10
					? `${organization.name.slice(0, width - 13)}...`
					: organization.name
			lines.push(boxRow(`${text("Org:", ANSI.dim)}  ${orgName}`, width, { boxStyle: "rounded" }))
		}

		let badge = ""
		if (organization?.organizationType === "claude_enterprise") {
			badge = text(" ENT", ANSI.fg.cyan)
		} else if (account.hasClaudeMax) {
			badge = text(" MAX", ANSI.fg.magenta)
		} else if (account.hasClaudePro) {
			badge = text(" PRO", ANSI.fg.green)
		}
		if (badge) {
			lines.push(boxRow(`${text("Plan:", ANSI.dim)}${badge}`, width, { boxStyle: "rounded" }))
		}
		lines.push(boxDivider(width, { boxStyle: "rounded" }))
	}

	if (!state.rateLimits) {
		if (state.lastError) {
			lines.push(
				boxRow(text(state.lastError.slice(0, width - 6), ANSI.fg.red), width, {
					boxStyle: "rounded",
				}),
			)
		} else {
			lines.push(boxRow(text("Loading...", ANSI.dim), width, { boxStyle: "rounded" }))
		}
	} else {
		const labelWidth = compact ? 3 : 8
		const barWidth = Math.max(5, width - labelWidth - 16)

		if (state.rateLimits.fiveHour) {
			const { utilization, resetsAt } = state.rateLimits.fiveHour
			const bar = progressBarWithThreshold(utilization, 100, "", {
				width: barWidth,
				showPercentage: false,
				showLabel: false,
			})
			const pct = `${Math.round(utilization)}%`.padStart(4)
			const reset = text(`(${formatTimeRemaining(resetsAt)})`, ANSI.dim)
			const label = compact ? "5h:" : "5-Hour: "
			lines.push(boxRow(`${label}${bar} ${pct} ${reset}`, width, { boxStyle: "rounded" }))
		}

		if (state.rateLimits.sevenDay) {
			const { utilization, resetsAt } = state.rateLimits.sevenDay
			const bar = progressBarWithThreshold(utilization, 100, "", {
				width: barWidth,
				showPercentage: false,
				showLabel: false,
			})
			const pct = `${Math.round(utilization)}%`.padStart(4)
			const reset = text(`(${formatTimeRemaining(resetsAt)})`, ANSI.dim)
			const label = compact ? "7d:" : "7-Day:  "
			lines.push(boxRow(`${label}${bar} ${pct} ${reset}`, width, { boxStyle: "rounded" }))
		}

		if (!state.rateLimits.fiveHour && !state.rateLimits.sevenDay) {
			lines.push(boxRow(text("No limits", ANSI.fg.green), width, { boxStyle: "rounded" }))
		}
	}

	if (state.lastFetch) {
		lines.push(boxDivider(width, { boxStyle: "rounded" }))
		lines.push(
			boxRow(text(`Updated: ${state.lastFetch.toLocaleTimeString()}`, ANSI.dim), width, {
				boxStyle: "rounded",
			}),
		)
	}

	lines.push(boxBottom(width, { boxStyle: "rounded" }))

	return lines
}

function renderUsageWidget(
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
	const lines: string[] = []
	const title = "API Usage (This Month)"

	lines.push(boxTop(width, title, { boxStyle: "rounded" }))

	if (!usage) {
		lines.push(boxRow(text("No data available", ANSI.dim), width, { boxStyle: "rounded" }))
		lines.push(boxRow("", width, { boxStyle: "rounded" }))
		lines.push(boxRow("Configure ANTHROPIC_ADMIN_API_KEY", width, { boxStyle: "rounded" }))
		lines.push(boxRow("to enable usage tracking.", width, { boxStyle: "rounded" }))
	} else {
		const inputStr = `Input:  ${text(formatTokens(usage.totalInputTokens), ANSI.fg.cyan)} tokens`
		const outputStr = `Output: ${text(formatTokens(usage.totalOutputTokens), ANSI.fg.cyan)} tokens`
		const costStr = `Cost:   ${text(formatCost(usage.totalCost, "USD"), ANSI.fg.green)}`

		lines.push(boxRow(inputStr, width, { boxStyle: "rounded" }))
		lines.push(boxRow(outputStr, width, { boxStyle: "rounded" }))
		lines.push(boxDivider(width, { boxStyle: "rounded" }))
		lines.push(boxRow(costStr, width, { boxStyle: "rounded" }))

		const lastUpdated = usage.lastUpdated.toLocaleTimeString()
		lines.push(boxDivider(width, { boxStyle: "rounded" }))
		lines.push(boxRow(text(`Updated: ${lastUpdated}`, ANSI.dim), width, { boxStyle: "rounded" }))
	}

	lines.push(boxBottom(width, { boxStyle: "rounded" }))

	return lines
}

function renderStatusBar(
	isRunning: boolean,
	lastError: string | null,
	refreshInterval: number,
): string {
	const status = isRunning ? text("● Running", ANSI.fg.green) : text("○ Stopped", ANSI.dim)

	const interval = `Refresh: ${refreshInterval}s`
	const error = lastError ? text(` | Error: ${lastError.slice(0, 30)}`, ANSI.fg.red) : ""

	return `${status} | ${interval}${error}`
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
			outputs.push(renderUsageWidget(usage, width).join("\n"))
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
			outputs.push(renderUsageWidget(state.usage, width).join("\n"))
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
		console.log(renderStatusBar(isRunning, lastError, config.display.refreshInterval))
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
