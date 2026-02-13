import {
	type CredentialSource,
	type OAuthCredentials,
	loadOAuthCredentials,
} from "./oauth-credentials"

const OAUTH_API_BASE = process.env.OAUTH_API_BASE ?? "https://api.anthropic.com/api/oauth"
const ANTHROPIC_BETA_VERSION = "oauth-2025-04-20"

export interface RateLimitWindow {
	utilization: number
	resetsAt: Date
}

export interface UsageData {
	fiveHour: RateLimitWindow | null
	sevenDay: RateLimitWindow | null
	sevenDayOauthApps: RateLimitWindow | null
	sevenDayOpus: RateLimitWindow | null
}

export interface AccountInfo {
	uuid: string
	fullName: string
	displayName: string
	email: string
	hasClaudeMax: boolean
	hasClaudePro: boolean
}

export interface OrganizationInfo {
	uuid: string
	name: string
	organizationType: string
	billingType: string
	rateLimitTier: string
}

export interface ProfileData {
	account: AccountInfo
	organization: OrganizationInfo | null
}

export interface OAuthApiError {
	type: "api_error" | "authentication_error" | "rate_limit_error" | "credentials_error"
	message: string
	statusCode: number
}

export type OAuthApiResult<T> =
	| { success: true; data: T }
	| { success: false; error: OAuthApiError }

function parseErrorMessage(responseBody: string): string {
	try {
		const parsed = JSON.parse(responseBody) as {
			error?: { message?: string } | string
			message?: string
		}
		if (typeof parsed.error === "object" && parsed.error?.message) {
			return parsed.error.message
		}
		if (typeof parsed.error === "string") {
			return parsed.error
		}
		if (parsed.message) {
			return parsed.message
		}
	} catch {
		// Not JSON, use as-is
	}
	return responseBody
}

function createError(statusCode: number, responseBody: string): OAuthApiError {
	let type: OAuthApiError["type"] = "api_error"
	if (statusCode === 401 || statusCode === 403) {
		type = "authentication_error"
	} else if (statusCode === 429) {
		type = "rate_limit_error"
	}
	return { type, message: parseErrorMessage(responseBody), statusCode }
}

export class ClaudeOAuthApi {
	private credentials: OAuthCredentials | null = null
	private credentialSource: CredentialSource | undefined

	constructor(credentials?: OAuthCredentials, credentialSource?: CredentialSource) {
		if (credentials) {
			this.credentials = credentials
		}
		this.credentialSource = credentialSource
	}

	private async ensureCredentials(): Promise<OAuthApiResult<OAuthCredentials>> {
		if (this.credentials) {
			return { success: true, data: this.credentials }
		}

		const result = loadOAuthCredentials(this.credentialSource)
		if (!result.success) {
			return {
				success: false,
				error: {
					type: "credentials_error",
					message: result.error,
					statusCode: 0,
				},
			}
		}

		this.credentials = result.credentials
		return { success: true, data: this.credentials }
	}

	private async request<T>(endpoint: string, isRetry = false): Promise<OAuthApiResult<T>> {
		const credResult = await this.ensureCredentials()
		if (!credResult.success) {
			return credResult
		}

		const usedToken = credResult.data.accessToken
		const url = `${OAUTH_API_BASE}${endpoint}`

		try {
			const response = await fetch(url, {
				method: "GET",
				headers: {
					Authorization: `Bearer ${usedToken}`,
					"anthropic-beta": ANTHROPIC_BETA_VERSION,
					"Content-Type": "application/json",
				},
			})

			if (!response.ok) {
				if (response.status === 401 || response.status === 403) {
					this.credentials = null

					if (!isRetry) {
						const refreshed = loadOAuthCredentials(this.credentialSource)
						if (refreshed.success && refreshed.credentials.accessToken !== usedToken) {
							this.credentials = refreshed.credentials
							return this.request<T>(endpoint, true)
						}
					}
				}
				const errorText = await response.text()
				return {
					success: false,
					error: createError(response.status, errorText),
				}
			}

			const data = (await response.json()) as T
			return { success: true, data }
		} catch (error) {
			return {
				success: false,
				error: createError(0, error instanceof Error ? error.message : "Network error"),
			}
		}
	}

	async getUsage(): Promise<OAuthApiResult<UsageData>> {
		const result = await this.request<RawUsageResponse>("/usage")

		if (!result.success) {
			return result
		}

		return {
			success: true,
			data: transformUsageResponse(result.data),
		}
	}

	async getProfile(): Promise<OAuthApiResult<ProfileData>> {
		const result = await this.request<RawProfileResponse>("/profile")

		if (!result.success) {
			return result
		}

		return {
			success: true,
			data: transformProfileResponse(result.data),
		}
	}

	async getRateLimitSummary(): Promise<
		OAuthApiResult<{
			usage: UsageData
			profile: ProfileData
		}>
	> {
		const [usageResult, profileResult] = await Promise.all([this.getUsage(), this.getProfile()])

		if (!usageResult.success) {
			return usageResult
		}

		if (!profileResult.success) {
			return profileResult
		}

		return {
			success: true,
			data: {
				usage: usageResult.data,
				profile: profileResult.data,
			},
		}
	}
}

interface RawRateLimitWindow {
	utilization: number
	resets_at: string
}

interface RawUsageResponse {
	five_hour: RawRateLimitWindow | null
	seven_day: RawRateLimitWindow | null
	seven_day_oauth_apps: RawRateLimitWindow | null
	seven_day_opus: RawRateLimitWindow | null
}

interface RawProfileResponse {
	account: {
		uuid: string
		full_name: string
		display_name: string
		email: string
		has_claude_max: boolean
		has_claude_pro: boolean
	}
	organization: {
		uuid: string
		name: string
		organization_type: string
		billing_type: string
		rate_limit_tier: string
	} | null
}

function transformRateLimitWindow(raw: RawRateLimitWindow | null): RateLimitWindow | null {
	if (!raw) return null
	return {
		utilization: raw.utilization,
		resetsAt: new Date(raw.resets_at),
	}
}

function transformUsageResponse(raw: RawUsageResponse): UsageData {
	return {
		fiveHour: transformRateLimitWindow(raw.five_hour),
		sevenDay: transformRateLimitWindow(raw.seven_day),
		sevenDayOauthApps: transformRateLimitWindow(raw.seven_day_oauth_apps),
		sevenDayOpus: transformRateLimitWindow(raw.seven_day_opus),
	}
}

function transformProfileResponse(raw: RawProfileResponse): ProfileData {
	return {
		account: {
			uuid: raw.account.uuid,
			fullName: raw.account.full_name,
			displayName: raw.account.display_name,
			email: raw.account.email,
			hasClaudeMax: raw.account.has_claude_max,
			hasClaudePro: raw.account.has_claude_pro,
		},
		organization: raw.organization
			? {
					uuid: raw.organization.uuid,
					name: raw.organization.name,
					organizationType: raw.organization.organization_type,
					billingType: raw.organization.billing_type,
					rateLimitTier: raw.organization.rate_limit_tier,
				}
			: null,
	}
}

export function createOAuthApi(
	credentials?: OAuthCredentials,
	credentialSource?: CredentialSource,
): ClaudeOAuthApi {
	return new ClaudeOAuthApi(credentials, credentialSource)
}
