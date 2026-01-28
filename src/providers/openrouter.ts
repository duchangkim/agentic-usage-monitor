import {
	type ProviderCredentials,
	type TimePeriod,
	UsageApiError,
	type UsageProvider,
	type UsageResult,
} from "../types"

const OPENROUTER_API_BASE = "https://openrouter.ai/api/v1"

export class OpenRouterProvider implements UsageProvider {
	readonly name = "openrouter" as const

	isConfigured(credentials: ProviderCredentials): boolean {
		return Boolean(credentials.apiKey)
	}

	async fetchUsage(credentials: ProviderCredentials, _period: TimePeriod): Promise<UsageResult> {
		if (!credentials.apiKey) {
			return {
				success: false,
				error: new UsageApiError("openrouter", 401, "API key not configured"),
			}
		}

		try {
			const response = await fetch(`${OPENROUTER_API_BASE}/auth/key`, {
				headers: {
					Authorization: `Bearer ${credentials.apiKey}`,
				},
			})

			if (!response.ok) {
				return {
					success: false,
					error: new UsageApiError("openrouter", response.status, await response.text()),
				}
			}

			const data = (await response.json()) as OpenRouterKeyResponse

			return {
				success: true,
				data: {
					provider: "openrouter",
					usage: {
						inputTokens: data.data?.usage ?? 0,
						outputTokens: 0,
						totalTokens: data.data?.usage ?? 0,
					},
					cost: {
						amount: (data.data?.usage ?? 0) / 1000, // Credits to approximate USD
						currency: "USD",
					},
					period: _period,
				},
			}
		} catch (error) {
			return {
				success: false,
				error: new UsageApiError(
					"openrouter",
					0,
					error instanceof Error ? error.message : "Unknown error",
					error,
				),
			}
		}
	}
}

interface OpenRouterKeyResponse {
	data?: {
		usage?: number
		limit?: number
		is_free_tier?: boolean
	}
}

export const openrouterProvider = new OpenRouterProvider()
