import type { Hooks, Plugin, PluginInput } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"

import { getAllProviders } from "./providers"
import type { Provider, ProviderCredentials, TimePeriod, UsageData } from "./types"
import { type Config, SimpleCache, formatUsageSummary, parseConfig } from "./utils"

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

					return formatUsageSummary(usageData, {
						currency: state.config.displayCurrency,
						locale: "en-US",
						showModelBreakdown: state.config.showModelBreakdown,
						compactMode: state.config.compactMode,
					})
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
