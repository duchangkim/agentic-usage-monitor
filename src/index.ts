import type { Hooks, Plugin, PluginInput } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"
import { createOAuthApi } from "./data"
import { getAllProviders } from "./providers"
import type { Provider, ProviderCredentials, TimePeriod, UsageData } from "./types"
import { type Config, SimpleCache, formatUsageTui, parseConfig } from "./utils"

function formatResetTime(resetDate: Date): string {
	const now = new Date()
	const diff = resetDate.getTime() - now.getTime()
	if (diff <= 0) return "now"
	const hours = Math.floor(diff / (1000 * 60 * 60))
	const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
	if (hours > 0) return `${hours}h ${minutes}m`
	return `${minutes}m`
}

const CACHE_TTL_MS = 5 * 60 * 1000

interface PluginState {
	config: Config
	cache: SimpleCache<UsageData>
}

function getDefaultPeriod(days: number): TimePeriod {
	const end = new Date()
	const start = new Date()
	start.setDate(start.getDate() - days)
	return { start, end }
}

function getCredentialsFromEnv(provider: Provider): ProviderCredentials {
	const envKeyMap: Record<Provider, string> = {
		anthropic: "ANTHROPIC_API_KEY",
		openai: "OPENAI_API_KEY",
		google: "GOOGLE_API_KEY",
		openrouter: "OPENROUTER_API_KEY",
	}

	return {
		apiKey: process.env[envKeyMap[provider]],
		organizationId: provider === "openai" ? process.env.OPENAI_ORG_ID : undefined,
		projectId: provider === "google" ? process.env.GOOGLE_PROJECT_ID : undefined,
	}
}

async function fetchAllUsage(
	state: PluginState,
	period: TimePeriod,
	providerFilter?: Provider,
): Promise<UsageData[]> {
	const providers = getAllProviders()
	const results: UsageData[] = []

	for (const provider of providers) {
		if (providerFilter && provider.name !== providerFilter) continue

		const cacheKey = `${provider.name}-${period.start.toISOString()}-${period.end.toISOString()}`
		const cached = state.cache.get(cacheKey)
		if (cached) {
			results.push(cached)
			continue
		}

		const providerConfig = state.config.providers?.[provider.name]
		if (providerConfig?.enabled === false) continue

		const credentials: ProviderCredentials = {
			...getCredentialsFromEnv(provider.name),
			...providerConfig,
		}

		if (!provider.isConfigured(credentials)) continue

		const result = await provider.fetchUsage(credentials, period)
		if (result.success) {
			state.cache.set(cacheKey, result.data)
			results.push(result.data)
		}
	}

	return results
}

export const UsageMonitorPlugin: Plugin = async (_ctx: PluginInput) => {
	const state: PluginState = {
		config: parseConfig({}),
		cache: new SimpleCache<UsageData>(CACHE_TTL_MS),
	}

	return {
		event: async ({ event }) => {
			if (event.type === "session.idle") {
				state.cache.prune()
			}
		},

		tool: {
			usage: tool({
				description:
					"Show LLM API usage statistics and costs for configured providers (Anthropic, OpenAI, Google, OpenRouter)",
				args: {
					provider: tool.schema
						.enum(["anthropic", "openai", "google", "openrouter"])
						.optional()
						.describe("Filter by specific provider"),
					days: tool.schema.number().default(7).describe("Number of days to show usage for"),
				},
				async execute(args) {
					const period = getDefaultPeriod(args.days)
					const usageData = await fetchAllUsage(
						state,
						period,
						args.provider as Provider | undefined,
					)

					return formatUsageTui(usageData, {
						currency: state.config.displayCurrency,
						locale: "en-US",
						showModelBreakdown: state.config.showModelBreakdown,
						compactMode: state.config.compactMode,
					})
				},
			}),

			rate_limits: tool({
				description: "Show Claude rate limits (5-hour and 7-day usage windows)",
				args: {},
				async execute() {
					const api = createOAuthApi()
					const result = await api.getRateLimitSummary()

					if (!result.success) {
						if (result.error.type === "credentials_error") {
							return `Error: ${result.error.message}\n\nRun 'opencode auth login' to authenticate.`
						}
						return `Error: ${result.error.message}`
					}

					const { usage, profile } = result.data
					const lines: string[] = []

					const { account, organization } = profile
					lines.push(`User: ${account.displayName || account.fullName}`)
					if (organization) {
						lines.push(`Org:  ${organization.name}`)
						const plan =
							organization.organizationType === "claude_enterprise"
								? "Enterprise"
								: account.hasClaudeMax
									? "Max"
									: account.hasClaudePro
										? "Pro"
										: "Free"
						lines.push(`Plan: ${plan}`)
					}
					lines.push("")

					const { fiveHour, sevenDay } = usage

					if (fiveHour) {
						const resetIn = formatResetTime(fiveHour.resetsAt)
						lines.push(`5-Hour:  ${fiveHour.utilization.toFixed(1)}% used (resets in ${resetIn})`)
					}

					if (sevenDay) {
						const resetIn = formatResetTime(sevenDay.resetsAt)
						lines.push(`7-Day:   ${sevenDay.utilization.toFixed(1)}% used (resets in ${resetIn})`)
					}

					if (!fiveHour && !sevenDay) {
						lines.push("No active rate limits")
					}

					return lines.join("\n")
				},
			}),

			monitor: tool({
				description:
					"Check tmux monitor status and get setup instructions for running usage monitor alongside opencode",
				args: {
					action: tool.schema
						.enum(["status", "setup", "help"])
						.default("status")
						.describe(
							"Action: status (check current state), setup (show setup guide), help (show usage)",
						),
				},
				async execute(args) {
					if (args.action === "help") {
						return `Usage Monitor - tmux Integration

The usage monitor runs in a separate tmux pane alongside opencode,
showing real-time rate limits and API usage.

COMMANDS:
  /monitor status  - Check if tmux and monitor are running
  /monitor setup   - Show setup instructions
  /monitor help    - Show this help

QUICK START:
  1. Exit opencode (or open a new terminal)
  2. Run: opencode-with-monitor
  3. The monitor will appear in a side pane

For more details, run: /monitor setup`
					}

					if (args.action === "setup") {
						return `Usage Monitor Setup Guide

STEP 1: Install tmux (if not installed)
  macOS:  brew install tmux
  Ubuntu: sudo apt install tmux
  Fedora: sudo dnf install tmux

STEP 2: Install usage-monitor globally
  bun install -g opencode-usage-monitor

STEP 3: Start opencode with monitor
  opencode-with-monitor

OPTIONS:
  -w 30           # Monitor width 30% (default: 25%)
  -l              # Monitor on left side
  -s myproject    # Custom session name
  -- --model opus # Pass args to opencode

EXAMPLE LAYOUT:
  ┌─────────────────────────────┬──────────┐
  │                             │ Monitor  │
  │      opencode (main)        │ ──────── │
  │                             │ 5h: 44%  │
  │                             │ 7d: 4%   │
  └─────────────────────────────┴──────────┘

TMUX BASICS:
  Ctrl+b %    Split pane horizontally
  Ctrl+b o    Switch between panes
  Ctrl+b x    Close current pane
  Ctrl+b d    Detach from session
  tmux attach Reattach to session`
					}

					const lines: string[] = ["Usage Monitor Status", ""]

					try {
						const tmuxWhich = Bun.spawnSync(["which", "tmux"])
						const tmuxInstalled = tmuxWhich.exitCode === 0

						if (tmuxInstalled) {
							lines.push("✓ tmux is installed")

							const inTmux = Boolean(process.env.TMUX)
							if (inTmux) {
								lines.push("✓ Running inside tmux session")
								const sessionProc = Bun.spawnSync(["tmux", "display-message", "-p", "#S"])
								if (sessionProc.exitCode === 0) {
									lines.push(`  Session: ${sessionProc.stdout.toString().trim()}`)
								}
							} else {
								lines.push("○ Not running inside tmux")
								lines.push("  Run 'opencode-with-monitor' to start with monitor")
							}

							const sessionsProc = Bun.spawnSync(["tmux", "list-sessions"])
							if (sessionsProc.exitCode === 0) {
								const sessionsOutput = sessionsProc.stdout.toString().trim()
								if (sessionsOutput) {
									lines.push("")
									lines.push("Active tmux sessions:")
									for (const session of sessionsOutput.split("\n")) {
										lines.push(`  ${session}`)
									}
								}
							}
						} else {
							lines.push("✗ tmux is not installed")
							lines.push("  Install: brew install tmux (macOS)")
						}
					} catch {
						lines.push("✗ Could not check tmux status")
					}

					lines.push("")
					lines.push("Run '/monitor setup' for installation guide")

					return lines.join("\n")
				},
			}),
		},
	} satisfies Partial<Hooks>
}

export default UsageMonitorPlugin

export type { Provider, UsageData, ProviderCredentials, TimePeriod, UsageApiError } from "./types"
export { createUsageApiError } from "./types"

export { createWidget, UsageWidget, type WidgetConfig, type WidgetPosition } from "./tui"
export { formatUsageTui } from "./utils"
