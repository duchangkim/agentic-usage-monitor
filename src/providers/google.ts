import {
	type ProviderCredentials,
	type TimePeriod,
	UsageApiError,
	type UsageProvider,
	type UsageResult,
} from "../types"

export class GoogleProvider implements UsageProvider {
	readonly name = "google" as const

	isConfigured(credentials: ProviderCredentials): boolean {
		return Boolean(credentials.apiKey || credentials.projectId)
	}

	async fetchUsage(credentials: ProviderCredentials, _period: TimePeriod): Promise<UsageResult> {
		if (!credentials.apiKey && !credentials.projectId) {
			return {
				success: false,
				error: new UsageApiError("google", 401, "API key or project ID not configured"),
			}
		}

		return {
			success: false,
			error: new UsageApiError(
				"google",
				501,
				"Google Cloud Billing API not yet implemented - requires OAuth2 service account credentials",
			),
		}
	}
}

export const googleProvider = new GoogleProvider()
