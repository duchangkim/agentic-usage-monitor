import {
	type ProviderCredentials,
	type TimePeriod,
	UsageApiError,
	type UsageProvider,
	type UsageResult,
} from "../types"

const OPENAI_API_BASE = "https://api.openai.com/v1"

export class OpenAIProvider implements UsageProvider {
	readonly name = "openai" as const

	isConfigured(credentials: ProviderCredentials): boolean {
		return Boolean(credentials.apiKey)
	}

	async fetchUsage(credentials: ProviderCredentials, period: TimePeriod): Promise<UsageResult> {
		if (!credentials.apiKey) {
			return {
				success: false,
				error: new UsageApiError("openai", 401, "API key not configured"),
			}
		}

		try {
			const startDate = Math.floor(period.start.getTime() / 1000)
			const endDate = Math.floor(period.end.getTime() / 1000)

			const response = await fetch(
				`${OPENAI_API_BASE}/organization/usage?start_time=${startDate}&end_time=${endDate}`,
				{
					headers: {
						Authorization: `Bearer ${credentials.apiKey}`,
						...(credentials.organizationId && {
							"OpenAI-Organization": credentials.organizationId,
						}),
					},
				},
			)

			if (!response.ok) {
				return {
					success: false,
					error: new UsageApiError("openai", response.status, await response.text()),
				}
			}

			const data = (await response.json()) as OpenAIUsageResponse

			const totalInputTokens =
				data.data?.reduce((sum, d) => sum + (d.n_context_tokens ?? 0), 0) ?? 0
			const totalOutputTokens =
				data.data?.reduce((sum, d) => sum + (d.n_generated_tokens ?? 0), 0) ?? 0

			return {
				success: true,
				data: {
					provider: "openai",
					usage: {
						inputTokens: totalInputTokens,
						outputTokens: totalOutputTokens,
						totalTokens: totalInputTokens + totalOutputTokens,
					},
					cost: {
						amount: 0, // OpenAI usage API doesn't return cost directly
						currency: "USD",
					},
					period,
				},
			}
		} catch (error) {
			return {
				success: false,
				error: new UsageApiError(
					"openai",
					0,
					error instanceof Error ? error.message : "Unknown error",
					error,
				),
			}
		}
	}
}

interface OpenAIUsageResponse {
	data?: Array<{
		n_context_tokens?: number
		n_generated_tokens?: number
	}>
}

export const openaiProvider = new OpenAIProvider()
