import {
	type ProviderCredentials,
	type TimePeriod,
	UsageApiError,
	type UsageProvider,
	type UsageResult,
} from "../types"

const ANTHROPIC_ADMIN_API_BASE = "https://api.anthropic.com/v1"

export class AnthropicProvider implements UsageProvider {
	readonly name = "anthropic" as const

	isConfigured(credentials: ProviderCredentials): boolean {
		return Boolean(credentials.apiKey)
	}

	async fetchUsage(credentials: ProviderCredentials, period: TimePeriod): Promise<UsageResult> {
		if (!credentials.apiKey) {
			return {
				success: false,
				error: new UsageApiError("anthropic", 401, "API key not configured"),
			}
		}

		try {
			const startDate = period.start.toISOString().split("T")[0]
			const endDate = period.end.toISOString().split("T")[0]

			const response = await fetch(
				`${ANTHROPIC_ADMIN_API_BASE}/organizations/usage?start_date=${startDate}&end_date=${endDate}`,
				{
					headers: {
						"x-api-key": credentials.apiKey,
						"anthropic-version": "2023-06-01",
					},
				},
			)

			if (!response.ok) {
				return {
					success: false,
					error: new UsageApiError("anthropic", response.status, await response.text()),
				}
			}

			const data = (await response.json()) as AnthropicUsageResponse

			return {
				success: true,
				data: {
					provider: "anthropic",
					usage: {
						inputTokens: data.total_input_tokens ?? 0,
						outputTokens: data.total_output_tokens ?? 0,
						totalTokens: (data.total_input_tokens ?? 0) + (data.total_output_tokens ?? 0),
					},
					cost: {
						amount: data.total_cost ?? 0,
						currency: "USD",
					},
					period,
				},
			}
		} catch (error) {
			return {
				success: false,
				error: new UsageApiError(
					"anthropic",
					0,
					error instanceof Error ? error.message : "Unknown error",
					error,
				),
			}
		}
	}
}

interface AnthropicUsageResponse {
	total_input_tokens?: number
	total_output_tokens?: number
	total_cost?: number
}

export const anthropicProvider = new AnthropicProvider()
