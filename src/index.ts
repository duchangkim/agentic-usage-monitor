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
		},
	} satisfies Partial<Hooks>
}

export default UsageMonitorPlugin

export type { Provider, UsageData, ProviderCredentials, TimePeriod, UsageApiError } from "./types"
export { createUsageApiError } from "./types"

export { createWidget, UsageWidget, type WidgetConfig, type WidgetPosition } from "./tui"
export { formatUsageTui } from "./utils"
